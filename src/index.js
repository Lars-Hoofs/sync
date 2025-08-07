"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const prisma_1 = require("./lib/prisma");
const api_1 = __importDefault(require("./routes/api"));
// Create Fastify instance
const fastify = (0, fastify_1.default)({
    logger: true
});
// Register CORS plugin
fastify.register(require('@fastify/cors'), {
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
fastify.register(api_1.default, { prefix: '/api' });
// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    try {
        await fastify.close();
        await prisma_1.prisma.$disconnect();
        console.log('✅ Server shut down successfully');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});
// Start server
const start = async () => {
    try {
        const port = Number(process.env.PORT) || 3000;
        const host = process.env.HOST || '0.0.0.0';
        console.log('🚀 Starting Sync API Server...');
        console.log('📊 Prisma client initialized');
        await fastify.listen({ port, host });
        console.log(`✅ Server running on http://localhost:${port}`);
    }
    catch (err) {
        console.error('❌ Server startup error:', err);
        await prisma_1.prisma.$disconnect();
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map