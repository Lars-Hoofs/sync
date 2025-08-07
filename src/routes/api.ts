import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma.js'

// Define route schemas for better API documentation
const healthSchema = {
  description: 'Health check endpoint to verify API is running',
  tags: ['Health'],
  response: {
    200: {
      description: 'API is healthy',
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' }
      }
    }
  }
}

const statusSchema = {
  description: 'Check API and database connection status',
  tags: ['Health'],
  response: {
    200: {
      description: 'Status check successful',
      type: 'object',
      properties: {
        api: { type: 'string', example: 'running' },
        database: { type: 'string', example: 'connected' },
        timestamp: { type: 'string', format: 'date-time' }
      }
    },
    500: {
      description: 'Database connection failed',
      type: 'object',
      properties: {
        api: { type: 'string', example: 'running' },
        database: { type: 'string', example: 'disconnected' },
        error: { type: 'string', example: 'Database connection failed' }
      }
    }
  }
}

const itemsListSchema = {
  description: 'Get all items (placeholder endpoint)',
  tags: ['Items'],
  response: {
    200: {
      description: 'List of items',
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Items endpoint - implement with your Prisma models' }
      }
    },
    500: {
      description: 'Error fetching items',
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
}

const itemsCreateSchema = {
  description: 'Create a new item (placeholder endpoint)',
  tags: ['Items'],
  response: {
    200: {
      description: 'Item created successfully',
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Create item endpoint - implement with your Prisma models' }
      }
    },
    500: {
      description: 'Error creating item',
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
}

// API Routes plugin
async function apiRoutes(fastify: FastifyInstance) {
  // Health check endpoint
  fastify.get('/health', { schema: healthSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString() 
    }
  })

  // Database status endpoint
  fastify.get('/status', { schema: statusSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Test database connection with a simple query
      await prisma.$queryRaw`SELECT 1`
      
      return { 
        api: 'running',
        database: 'connected',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      reply.code(500)
      return {
        api: 'running',
        database: 'disconnected',
        error: 'Database connection failed'
      }
    }
  })

  // Example CRUD endpoints (placeholder for your models)
  
  // GET /api/items - List all items
  fastify.get('/items', { schema: itemsListSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Example: Replace with your actual Prisma model
      // const items = await prisma.item.findMany()
      
      return {
        message: 'Items endpoint - implement with your Prisma models',
        // data: items
      }
    } catch (error) {
      reply.code(500)
      return { error: 'Failed to fetch items' }
    }
  })

  // POST /api/items - Create a new item
  fastify.post('/items', { schema: itemsCreateSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Example: Replace with your actual Prisma model
      // const item = await prisma.item.create({ data: request.body })
      
      return {
        message: 'Create item endpoint - implement with your Prisma models',
        // data: item
      }
    } catch (error) {
      reply.code(500)
      return { error: 'Failed to create item' }
    }
  })
}

export default apiRoutes
