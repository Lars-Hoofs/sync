"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = require("fastify");
const prisma_1 = require("../lib/prisma");
// Define route schemas for better API documentation
const healthSchema = {
    response: {
        200: {
            type: 'object',
            properties: {
                status: { type: 'string' },
                timestamp: { type: 'string' }
            }
        }
    }
};
const statusSchema = {
    response: {
        200: {
            type: 'object',
            properties: {
                api: { type: 'string' },
                database: { type: 'string' },
                timestamp: { type: 'string' }
            }
        },
        500: {
            type: 'object',
            properties: {
                api: { type: 'string' },
                database: { type: 'string' },
                error: { type: 'string' }
            }
        }
    }
};
// API Routes plugin
async function apiRoutes(fastify) {
    // Health check endpoint
    fastify.get('/health', { schema: healthSchema }, async (request, reply) => {
        return {
            status: 'ok',
            timestamp: new Date().toISOString()
        };
    });
    // Database status endpoint
    fastify.get('/status', { schema: statusSchema }, async (request, reply) => {
        try {
            // Test database connection with a simple query
            await prisma_1.prisma.$queryRaw `SELECT 1`;
            return {
                api: 'running',
                database: 'connected',
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            reply.code(500);
            return {
                api: 'running',
                database: 'disconnected',
                error: 'Database connection failed'
            };
        }
    });
    // Example CRUD endpoints (placeholder for your models)
    // GET /api/items - List all items
    fastify.get('/items', async (request, reply) => {
        try {
            // Example: Replace with your actual Prisma model
            // const items = await prisma.item.findMany()
            return {
                message: 'Items endpoint - implement with your Prisma models',
                // data: items
            };
        }
        catch (error) {
            reply.code(500);
            return { error: 'Failed to fetch items' };
        }
    });
    // POST /api/items - Create a new item
    fastify.post('/items', async (request, reply) => {
        try {
            // Example: Replace with your actual Prisma model
            // const item = await prisma.item.create({ data: request.body })
            return {
                message: 'Create item endpoint - implement with your Prisma models',
                // data: item
            };
        }
        catch (error) {
            reply.code(500);
            return { error: 'Failed to create item' };
        }
    });
}
exports.default = apiRoutes;
//# sourceMappingURL=api.js.map