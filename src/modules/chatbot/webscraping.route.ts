import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WebScrapingController } from './webscraping.controller.js';
import { authenticate } from '../../shared/middlewares/auth.js';

export default async function webScrapingRoutes(fastify: FastifyInstance) {
  const webScrapingController = new WebScrapingController(fastify.prisma);

  // Middleware voor alle webscraping routes
  fastify.addHook('onRequest', authenticate);

  // Start website crawl
  fastify.post('/chatbots/:chatbotId/scraping/crawl', {
    schema: {
      tags: ['WebScraping'],
      summary: 'Start website crawl',
      description: 'Start een complete crawl van een website voor chatbot data',
      params: {
        type: 'object',
        required: ['chatbotId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['startUrl'],
        properties: {
          startUrl: { type: 'string', format: 'uri' },
          maxDepth: { type: 'integer', minimum: 1, maximum: 10, default: 3 },
          maxPages: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
          includePaths: { 
            type: 'array',
            items: { type: 'string' }
          },
          excludePaths: {
            type: 'array', 
            items: { type: 'string' }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                crawlId: { type: 'string' },
                status: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        },
        400: { $ref: 'ErrorResponse' },
        401: { $ref: 'ErrorResponse' },
        403: { $ref: 'ErrorResponse' }
      }
    }
  }, webScrapingController.startCrawl.bind(webScrapingController));

  // Get crawl status
  fastify.get('/chatbots/:chatbotId/scraping/crawl/:crawlId/status', {
    schema: {
      tags: ['WebScraping'],
      summary: 'Get crawl status',
      description: 'Haal de status op van een lopende crawl',
      params: {
        type: 'object',
        required: ['chatbotId', 'crawlId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' },
          crawlId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                crawlId: { type: 'string' },
                status: { type: 'string', enum: ['running', 'completed', 'failed', 'cancelled'] },
                progress: {
                  type: 'object',
                  properties: {
                    totalPages: { type: 'integer' },
                    completedPages: { type: 'integer' },
                    failedPages: { type: 'integer' },
                    percentage: { type: 'number' }
                  }
                },
                startedAt: { type: 'string', format: 'date-time' },
                completedAt: { type: 'string', format: 'date-time' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, webScrapingController.getCrawlStatus.bind(webScrapingController));

  // Cancel crawl
  fastify.delete('/chatbots/:chatbotId/scraping/crawl/:crawlId', {
    schema: {
      tags: ['WebScraping'],
      summary: 'Cancel crawl',
      description: 'Annuleer een lopende website crawl',
      params: {
        type: 'object',
        required: ['chatbotId', 'crawlId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' },
          crawlId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, webScrapingController.cancelCrawl.bind(webScrapingController));

  // Scrape single page
  fastify.post('/chatbots/:chatbotId/scraping/page', {
    schema: {
      tags: ['WebScraping'],
      summary: 'Scrape single page',
      description: 'Scrape een enkele webpagina voor chatbot data',
      params: {
        type: 'object',
        required: ['chatbotId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', format: 'uri' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                title: { type: 'string' },
                content: { type: 'string' },
                metadata: { type: 'object' },
                scrapedAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  }, webScrapingController.scrapePage.bind(webScrapingController));

  // Get available content
  fastify.get('/chatbots/:chatbotId/scraping/content', {
    schema: {
      tags: ['WebScraping'],
      summary: 'Get scraped content',
      description: 'Haal alle gescrapede content op voor een chatbot',
      params: {
        type: 'object',
        required: ['chatbotId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                content: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      url: { type: 'string' },
                      title: { type: 'string' },
                      contentPreview: { type: 'string' },
                      scrapedAt: { type: 'string', format: 'date-time' }
                    }
                  }
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    total: { type: 'integer' },
                    pages: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, webScrapingController.getScrapedContent.bind(webScrapingController));
}
