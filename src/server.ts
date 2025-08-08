import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/utils/logger.js';

async function start() {
  try {
    const app = await createApp();

    const address = await app.listen({ 
      port: env.PORT, 
      host: env.HOST 
    });
    
    logger.info(`Server gestart op adres : ${address}`);
    logger.info(`Api documentatie beschikbaar op ${address}/docs`);

    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      app.close().then(() => {
        logger.info('✅ Server shut down successfully');
        process.exit(0);
      }).catch((err) => {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.fatal({ err: error }, '❌ Failed to start server');
    process.exit(1);
  }
}

start();
