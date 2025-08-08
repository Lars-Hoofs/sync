import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/utils/logger.js';

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'info',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
  });

  // Log Prisma events
  prisma.$on('query', (e) => {
    logger.debug({
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    }, 'Database query executed');
  });

  prisma.$on('error', (e) => {
    logger.error({
      target: e.target,
      message: e.message,
    }, 'Database error occurred');
  });

  prisma.$on('info', (e) => {
    logger.info({
      target: e.target,
      message: e.message,
    }, 'Database info');
  });

  prisma.$on('warn', (e) => {
    logger.warn({
      target: e.target,
      message: e.message,
    }, 'Database warning');
  });

  // Connect to database
  try {
    await prisma.$connect();
    logger.info('Database succesvol geconnected');
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to connect to database');
    throw error;
  }

  // Make Prisma available throughout the application
  fastify.decorate('prisma', prisma);

  // Graceful shutdown
  fastify.addHook('onClose', async (instance) => {
    logger.info('Disconnecting from database...');
    await instance.prisma.$disconnect();
    logger.info('✅ Database disconnected');
  });
};

export default fp(prismaPlugin, {
  name: 'prisma',
});
