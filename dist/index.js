import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from './lib/prisma.js';
import apiRoutes from './routes/api.js';
// Create server setup function
async function createServer() {
    // Create Fastify instance
    const fastify = Fastify({
        logger: true
    });
    // Register CORS plugin
    await fastify.register(cors, {
        origin: true
    });
    // Root route
    fastify.get('/', async (request, reply) => {
        return {
            message: 'Welcome to Sync API',
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            endpoints: {
                health: '/api/health',
                status: '/api/status',
                items: '/api/items'
            }
        };
    });
    // Register API routes with prefix
    await fastify.register(apiRoutes, { prefix: '/api' });
    return fastify;
}
// Start server
const start = async () => {
    try {
        const port = Number(process.env.PORT) || 3000;
        const host = process.env.HOST || '0.0.0.0';
        console.log('🚀 Starting Sync API Server...');
        console.log('📊 Prisma client initialized');
        const fastify = await createServer();
        await fastify.listen({ port, host });
        console.log(`✅ Server running on http://localhost:${port}`);
        // Setup graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down gracefully...');
            try {
                await fastify.close();
                await prisma.$disconnect();
                console.log('✅ Server shut down successfully');
                process.exit(0);
            }
            catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        });
    }
    catch (err) {
        console.error('❌ Server startup error:', err);
        await prisma.$disconnect();
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map