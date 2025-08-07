import Fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { prisma } from './lib/prisma.js'
import apiRoutes from './routes/api.js'

// Create server setup function
async function createServer() {
  // Create Fastify instance
  const fastify = Fastify({
    logger: true
  })

  // Register Swagger for API documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Sync API',
        description: 'High-performance API built with Fastify and Prisma',
        version: '1.0.0'
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server'
        }
      ],
      tags: [
        { name: 'Health', description: 'Health check endpoints' }
      ]
    }
  })

  // Register Swagger UI
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    },
    staticCSP: true,
    transformSpecificationClone: true
  })

  // Register CORS plugin
  await fastify.register(cors, {
    origin: true
  })

  // Root route
  fastify.get('/', {
    schema: {
      description: 'API Information and available endpoints',
      tags: ['Info'],
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            version: { type: 'string' },
            environment: { type: 'string' },
            documentation: { type: 'string' },
            endpoints: {
              type: 'object',
              properties: {
                health: { type: 'string' },
                status: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    return { 
      message: 'Welcome to Sync API', 
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      documentation: '/docs',
      endpoints: {
        health: '/api/health',
        status: '/api/status'
      }
    }
  })

  // Register API routes with prefix
  await fastify.register(apiRoutes, { prefix: '/api' })
  
  return fastify
}

// Start server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000
    const host = process.env.HOST || '0.0.0.0'
    
    console.log('🚀 Starting Sync API Server...')
    console.log('📊 Prisma client initialized')
    
    const fastify = await createServer()
    await fastify.listen({ port, host })
    console.log(`✅ Server running on http://localhost:${port}`)
    console.log(`📚 API Documentation available at http://localhost:${port}/docs`)
    
    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down gracefully...')
      try {
        await fastify.close()
        await prisma.$disconnect()
        console.log('✅ Server shut down successfully')
        process.exit(0)
      } catch (error) {
        console.error('❌ Error during shutdown:', error)
        process.exit(1)
      }
    })
    
  } catch (err) {
    console.error('❌ Server startup error:', err)
    await prisma.$disconnect()
    process.exit(1)
  }
}

start()
