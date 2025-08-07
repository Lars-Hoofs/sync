import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma.js'

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
}

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
