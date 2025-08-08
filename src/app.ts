import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import requestContext from '@fastify/request-context';
import * as Sentry from '@sentry/node';

import { env } from './config/env.js';
import { swaggerConfig, swaggerUiConfig } from './config/swagger.js';
import { logger } from './shared/utils/logger.js';
import { generateUUID } from './shared/utils/crypto.js';

import prismaPlugin from './plugins/prisma.js';

import { registerRoutes } from './routes.js';

export async function createApp(): Promise<FastifyInstance> {
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
  }

  const app = Fastify({
    logger: false, 
    requestIdLogLabel: 'requestId',
    requestIdHeader: 'x-request-id',
    genReqId: (req) => {
      return req.headers['x-request-id'] as string || generateUUID();
    },
    trustProxy: true,
  });

  await app.register(requestContext);

  app.addHook('onRequest', async (request, reply) => {
    request.requestId = request.id;
    (app.requestContext as any).set('requestId', request.id);
    (app.requestContext as any).set('startTime', Date.now());
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || env.CORS_ORIGIN === '*') {
        callback(null, true);
        return;
      }
      
      const allowed = env.CORS_ORIGIN.split(',').map(o => o.trim());
      callback(null, allowed.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    keyGenerator: (request) => {
      const userId = (request as any).user?.id;
      return userId || request.ip;
    },
  });

  await app.register(cookie, {
    secret: env.SESSION_SECRET,
    parseOptions: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
    },
  });

  await app.register(swagger, swaggerConfig);
  await app.register(swaggerUi, swaggerUiConfig);

  const { commonSchemas } = await import('./shared/schemas/common.js');
  for (const schema of commonSchemas) {
    app.addSchema(schema);
  }

  // Database
  await app.register(prismaPlugin);

  // Health check endpoint
  app.get('/health', async (request, reply) => {
    try {
      // Check database connection
      await app.prisma.$queryRaw`SELECT 1 as health_check`;
      
      return reply.code(200).send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        version: '1.0.0',
      });
    } catch (error) {
      logger.error({ err: error }, 'Health check failed');
      return reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed',
      });
    }
  });

  // Register all routes
  await registerRoutes(app);

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    const requestId = request.id;
    
    logger.error({
      err: error,
      requestId,
      url: request.url,
      method: request.method,
    }, 'Request error occurred');

    if (env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: {
          requestId,
          url: request.url,
          method: request.method,
        },
      });
    }

    const statusCode = error.statusCode || 500;
    const isDevelopment = env.NODE_ENV === 'development';

    return reply.code(statusCode).send({
      success: false,
      error: {
        message: error.message || 'Internal Server Error',
        code: (error as any).code || 'INTERNAL_SERVER_ERROR',
        requestId,
        ...(isDevelopment && { stack: error.stack }),
      },
    });
  });

  // 404 handler
  app.setNotFoundHandler(async (request, reply) => {
    return reply.code(404).send({
      success: false,
      error: {
        message: `Route ${request.method} ${request.url} not found`,
        code: 'ROUTE_NOT_FOUND',
        requestId: request.id,
      },
    });
  });

  // Request logging
  app.addHook('onResponse', async (request, reply) => {
    const startTime = (app.requestContext as any).get('startTime') || Date.now();
    const duration = Date.now() - startTime;
    
    logger.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
      requestId: request.id,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    }, `${request.method} ${request.url} - ${reply.statusCode} (${duration}ms)`);
  });

  return app;
}
