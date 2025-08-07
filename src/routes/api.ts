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
}

export default apiRoutes
