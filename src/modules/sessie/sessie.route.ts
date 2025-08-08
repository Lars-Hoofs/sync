import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { SessieController } from './sessie.controller.js';
import { SessieService } from './sessie.service.js';
import { authenticate } from '../../shared/middlewares/auth.js';

export default async function sessieRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  const sessieService = new SessieService(fastify.prisma);
  const sessieController = new SessieController(sessieService);

  // Apply authentication to all routes
  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/gebruikers/sessies - Haal actieve sessies op
  fastify.get('/sessies', {
    schema: {
      tags: ['Gebruikers', 'Sessies'],
      summary: 'Haal actieve sessies op',
      description: 'Haal alle actieve sessies van de huidige gebruiker op',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totaalActief: { type: 'number' },
                huidigeSessie: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    status: { type: 'string' },
                    ipAdres: { type: 'string' },
                    deviceType: { type: 'string' },
                    browser: { type: 'string', nullable: true },
                    os: { type: 'string', nullable: true },
                    isMobile: { type: 'boolean' },
                    isHuidigeSessie: { type: 'boolean' },
                    laatsteActiviteit: { type: 'string' },
                    aangemaaktOp: { type: 'string' },
                    locatie: { type: 'string', nullable: true }
                  }
                },
                sessies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string' },
                      ipAdres: { type: 'string' },
                      deviceType: { type: 'string' },
                      browser: { type: 'string', nullable: true },
                      os: { type: 'string', nullable: true },
                      isMobile: { type: 'boolean' },
                      isHuidigeSessie: { type: 'boolean' },
                      laatsteActiviteit: { type: 'string' },
                      aangemaaktOp: { type: 'string' },
                      locatie: { type: 'string', nullable: true }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    },
    handler: sessieController.getActieveSessies.bind(sessieController)
  });

  // DELETE /api/v1/sessies/:id - Beëindig specifieke sessie
  fastify.delete('/sessies/:id', {
    schema: {
      tags: ['Sessies'],
      summary: 'Beëindig sessie',
      description: 'Beëindig een specifieke sessie',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
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
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    },
    handler: sessieController.beeindigSessie.bind(sessieController)
  });

  // DELETE /api/v1/gebruikers/sessies/andere - Beëindig alle andere sessies
  fastify.delete('/sessies/andere', {
    schema: {
      tags: ['Gebruikers', 'Sessies'],
      summary: 'Beëindig andere sessies',
      description: 'Beëindig alle andere actieve sessies behalve de huidige',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                aantal: { type: 'number' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    },
    handler: sessieController.beeindigAndereSessies.bind(sessieController)
  });
}
