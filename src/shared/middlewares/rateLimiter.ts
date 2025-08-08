import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { HTTP_STATUS, ERROR_CODES, RATE_LIMITS } from '../../config/constants.js';
import { addTimeToDate } from '../utils/helpers.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('RateLimiter');

interface RateLimitConfig {
  max: number;
  windowMs: number;
  keyGenerator?: (request: FastifyRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

/**
 * Generate rate limiting key
 */
function defaultKeyGenerator(request: FastifyRequest): string {
  const user = (request as any).user;
  if (user) {
    return `user:${user.id}`;
  }
  return `ip:${request.ip}`;
}

/**
 * Rate limiting middleware factory
 */
export function createRateLimit(config: RateLimitConfig) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const prisma = (request.server as any).prisma as PrismaClient;
    const keyGenerator = config.keyGenerator || defaultKeyGenerator;
    
    try {
      const key = keyGenerator(request);
      const endpoint = `${request.method} ${(request as any).routerPath || request.url}`;
      const now = new Date();
      const windowStart = new Date(now.getTime() - config.windowMs);
      
      // Find or create rate limit record
      let rateLimitRecord = await prisma.rateLimit.findUnique({
        where: {
          ipAdres_gebruikerId_endpoint: {
            ipAdres: key.startsWith('ip:') ? key.substring(3) : null,
            gebruikerId: key.startsWith('user:') ? key.substring(5) : null,
            endpoint,
          }
        }
      });

      // Reset if window has passed
      if (!rateLimitRecord || rateLimitRecord.resetTijd < windowStart) {
        rateLimitRecord = await prisma.rateLimit.upsert({
          where: {
            ipAdres_gebruikerId_endpoint: {
              ipAdres: key.startsWith('ip:') ? key.substring(3) : null,
              gebruikerId: key.startsWith('user:') ? key.substring(5) : null,
              endpoint,
            }
          },
          create: {
            ipAdres: key.startsWith('ip:') ? key.substring(3) : null,
            gebruikerId: key.startsWith('user:') ? key.substring(5) : null,
            endpoint,
            aantalCalls: 1,
            resetTijd: new Date(now.getTime() + config.windowMs),
          },
          update: {
            aantalCalls: 1,
            resetTijd: new Date(now.getTime() + config.windowMs),
            bijgewerktOp: now,
          }
        });
      } else {
        // Check if limit exceeded
        if (rateLimitRecord.aantalCalls >= config.max) {
          const retryAfter = Math.ceil((rateLimitRecord.resetTijd.getTime() - now.getTime()) / 1000);
          
          reply.header('X-RateLimit-Limit', config.max);
          reply.header('X-RateLimit-Remaining', 0);
          reply.header('X-RateLimit-Reset', Math.ceil(rateLimitRecord.resetTijd.getTime() / 1000));
          reply.header('Retry-After', retryAfter);
          
          logger.warn({
            key,
            endpoint,
            count: rateLimitRecord.aantalCalls,
            max: config.max,
          }, 'Rate limit exceeded');
          
          return reply.code(HTTP_STATUS.TOO_MANY_REQUESTS).send({
            success: false,
            message: config.message || 'Te veel verzoeken. Probeer later opnieuw.',
            errors: [{
              field: 'rateLimit',
              message: `Maximaal ${config.max} verzoeken per ${Math.ceil(config.windowMs / 60000)} minuten`,
              code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
            }]
          });
        }

        // Increment counter
        rateLimitRecord = await prisma.rateLimit.update({
          where: { id: rateLimitRecord.id },
          data: {
            aantalCalls: { increment: 1 },
            bijgewerktOp: now,
          }
        });
      }

      // Set rate limit headers
      reply.header('X-RateLimit-Limit', config.max);
      reply.header('X-RateLimit-Remaining', Math.max(0, config.max - rateLimitRecord.aantalCalls));
      reply.header('X-RateLimit-Reset', Math.ceil(rateLimitRecord.resetTijd.getTime() / 1000));
      
    } catch (error) {
      logger.error({ err: error }, 'Rate limiting error');
      // Don't block requests if rate limiting fails
    }
  };
}

/**
 * Predefined rate limiters
 */
export const strictRateLimit = createRateLimit({
  max: RATE_LIMITS.STRICT.max,
  windowMs: 60 * 1000, // 1 minute
  message: 'Te veel verzoeken voor deze gevoelige actie'
});

export const authRateLimit = createRateLimit({
  max: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyGenerator: (request) => `auth:${request.ip}`,
  message: 'Te veel login pogingen. Probeer over 15 minuten opnieuw.'
});

export const apiRateLimit = createRateLimit({
  max: RATE_LIMITS.NORMAL.max,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

export const publicRateLimit = createRateLimit({
  max: 20,
  windowMs: 60 * 1000, // 1 minute
  keyGenerator: (request) => `public:${request.ip}`,
  message: 'Te veel openbare API verzoeken'
});

/**
 * Rate limit cleanup service
 */
export class RateLimitService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Clean up expired rate limit records
   */
  async cleanup(): Promise<{ cleaned: number }> {
    try {
      const result = await this.prisma.rateLimit.deleteMany({
        where: {
          resetTijd: {
            lt: new Date()
          }
        }
      });

      logger.info({ count: result.count }, 'Rate limit records cleaned up');
      
      return { cleaned: result.count };
    } catch (error) {
      logger.error({ err: error }, 'Rate limit cleanup failed');
      return { cleaned: 0 };
    }
  }

  /**
   * Get rate limit stats for user
   */
  async getUserStats(userId: string): Promise<Array<{
    endpoint: string;
    aantalCalls: number;
    resetTijd: Date;
  }>> {
    try {
      return await this.prisma.rateLimit.findMany({
        where: {
          gebruikerId: userId,
          resetTijd: { gt: new Date() }
        },
        select: {
          endpoint: true,
          aantalCalls: true,
          resetTijd: true,
        },
        orderBy: {
          aantalCalls: 'desc'
        }
      });
    } catch (error) {
      logger.error({ err: error, userId }, 'Failed to get rate limit stats');
      return [];
    }
  }

  /**
   * Reset rate limits for user (admin function)
   */
  async resetUserLimits(userId: string): Promise<{ reset: number }> {
    try {
      const result = await this.prisma.rateLimit.deleteMany({
        where: {
          gebruikerId: userId
        }
      });

      logger.info({ userId, count: result.count }, 'Rate limits reset for user');
      
      return { reset: result.count };
    } catch (error) {
      logger.error({ err: error, userId }, 'Failed to reset rate limits');
      return { reset: 0 };
    }
  }
}
