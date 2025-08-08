import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  maakChatbotJsonSchema,
  updateChatbotJsonSchema,
  chatbotDetailJsonSchema,
  chatbotOverzichtJsonSchema,
  maakDatabronJsonSchema,
  updateDatabronJsonSchema,
  voegTekstToeJsonSchema
} from './chatbot.schema.js';
import { ChatbotController } from './chatbot.controller.js';
import { authenticate } from '../../shared/middlewares/auth.js';

export default async function chatbotRoutes(fastify: FastifyInstance) {
  const chatbotController = new ChatbotController(fastify.prisma);

  // Middleware voor alle chatbot routes
  fastify.addHook('onRequest', authenticate);

  // Maak nieuwe chatbot
  fastify.post('/chatbots', {
    schema: {
      tags: ['Chatbots'],
      summary: 'Maak nieuwe chatbot aan',
      description: 'Maak een nieuwe chatbot aan binnen een organisatie',
      body: maakChatbotJsonSchema,
      response: {
        201: chatbotDetailJsonSchema,
        400: { $ref: 'ErrorResponse' },
        401: { $ref: 'ErrorResponse' },
        403: { $ref: 'ErrorResponse' }
      }
    }
  }, chatbotController.maakChatbot.bind(chatbotController));

  // Haal alle chatbots op van gebruiker
  fastify.get('/chatbots', {
    schema: {
      tags: ['Chatbots'],
      summary: 'Haal alle chatbots op',
      description: 'Haal alle chatbots op waar de gebruiker toegang toe heeft',
      querystring: {
        type: 'object',
        properties: {
          organisatieId: { type: 'string', format: 'uuid' },
          status: { 
            type: 'string', 
            enum: ['CONCEPT', 'ACTIEF', 'GEPAUZEERD', 'GEARCHIVEERD'] 
          },
          zoekTerm: { type: 'string' },
          pagina: { type: 'integer', minimum: 1, default: 1 },
          limiet: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
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
                chatbots: {
                  type: 'array',
                  items: chatbotOverzichtJsonSchema
                },
                totaal: { type: 'integer' },
                pagina: { type: 'integer' },
                limiet: { type: 'integer' }
              }
            }
          }
        }
      }
    }
  }, chatbotController.getChatbots.bind(chatbotController));

  // Haal specifieke chatbot op
  fastify.get('/chatbots/:chatbotId', {
    schema: {
      tags: ['Chatbots'],
      summary: 'Haal chatbot op',
      description: 'Haal een specifieke chatbot op met alle details',
      params: {
        type: 'object',
        required: ['chatbotId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        200: chatbotDetailJsonSchema,
        404: { $ref: 'ErrorResponse' },
        403: { $ref: 'ErrorResponse' }
      }
    }
  }, chatbotController.getChatbotById.bind(chatbotController));

  // Update chatbot
  fastify.put('/chatbots/:chatbotId', {
    schema: {
      tags: ['Chatbots'],
      summary: 'Update chatbot',
      description: 'Update een bestaande chatbot',
      params: {
        type: 'object',
        required: ['chatbotId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' }
        }
      },
      body: updateChatbotJsonSchema,
      response: {
        200: chatbotDetailJsonSchema,
        404: { $ref: 'ErrorResponse' },
        403: { $ref: 'ErrorResponse' }
      }
    }
  }, chatbotController.updateChatbot.bind(chatbotController));

  // Verwijder chatbot
  fastify.delete('/chatbots/:chatbotId', {
    schema: {
      tags: ['Chatbots'],
      summary: 'Verwijder chatbot',
      description: 'Verwijder een chatbot permanent',
      params: {
        type: 'object',
        required: ['chatbotId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        404: { $ref: 'ErrorResponse' },
        403: { $ref: 'ErrorResponse' }
      }
    }
  }, chatbotController.verwijderChatbot.bind(chatbotController));

  // Toggle chatbot status
  fastify.patch('/chatbots/:chatbotId/status', {
    schema: {
      tags: ['Chatbots'],
      summary: 'Wijzig chatbot status',
      description: 'Activeer, pauzeer of archiveer een chatbot',
      params: {
        type: 'object',
        required: ['chatbotId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { 
            type: 'string', 
            enum: ['CONCEPT', 'ACTIEF', 'GEPAUZEERD', 'GEARCHIVEERD'] 
          }
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
  }, chatbotController.wijzigStatus.bind(chatbotController));

  // Databron routes
  fastify.post('/chatbots/:chatbotId/databronnen', {
    schema: {
      tags: ['Chatbots'],
      summary: 'Voeg databron toe',
      description: 'Voeg een nieuwe databron toe aan een chatbot',
      params: {
        type: 'object',
        required: ['chatbotId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' }
        }
      },
      body: maakDatabronJsonSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                naam: { type: 'string' },
                type: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, chatbotController.maakDatabron.bind(chatbotController));

  // Voeg tekst toe aan databron
  fastify.post('/chatbots/:chatbotId/databronnen/:databronId/teksten', {
    schema: {
      tags: ['Chatbots'],
      summary: 'Voeg tekst toe',
      description: 'Voeg tekst toe aan een databron',
      params: {
        type: 'object',
        required: ['chatbotId', 'databronId'],
        properties: {
          chatbotId: { type: 'string', format: 'uuid' },
          databronId: { type: 'string', format: 'uuid' }
        }
      },
      body: voegTekstToeJsonSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                onderwerp: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, chatbotController.voegTekstToe.bind(chatbotController));
}
