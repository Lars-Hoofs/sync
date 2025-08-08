import pino from 'pino';
import { env } from '../../config/env.js';

const transport = env.LOG_PRETTY && env.NODE_ENV === 'development'
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

export const logger = pino({
  level: env.LOG_LEVEL,
  transport,
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'wachtwoord',
      'password',
      'token',
      'secret',
      'key',
    ],
    remove: true,
  },
});

// Maak context-aware logger functies
export const createLogger = (context: string) => {
  return logger.child({ context });
};

// Error logging helper
export const logError = (error: Error, context?: string, metadata?: Record<string, any>) => {
  logger.error({
    err: error,
    context,
    ...metadata,
  }, `Fout opgetreden: ${error.message}`);
};

// Performance logging helper
export const logPerformance = (operation: string, startTime: number, metadata?: Record<string, any>) => {
  const duration = Date.now() - startTime;
  logger.info({
    operation,
    duration: `${duration}ms`,
    ...metadata,
  }, `Performance: ${operation} completed in ${duration}ms`);
};

// Audit logging helper
export const logAudit = (
  action: string,
  userId?: string,
  organisatieId?: string,
  metadata?: Record<string, any>
) => {
  logger.info({
    type: 'audit',
    action,
    userId,
    organisatieId,
    timestamp: new Date().toISOString(),
    ...metadata,
  }, `Audit: ${action}`);
};
