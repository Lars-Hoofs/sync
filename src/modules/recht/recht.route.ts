import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RechtController } from './recht.controller.js';
import { authenticate } from '../../shared/middlewares/auth.js';

export default async function rechtRoutes(fastify: FastifyInstance) {
  const rechtController = new RechtController(fastify.prisma);

  // Middleware voor alle recht routes
  fastify.addHook('onRequest', authenticate);

  // Haal alle rechten op
  fastify.get('/rechten', {
    schema: {
      tags: ['Rechten'],
      summary: 'Haal alle rechten op',
      description: 'Haal alle beschikbare rechten op in het systeem',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  naam: { type: 'string' },
                  beschrijving: { type: 'string' },
                  categorie: { type: 'string' },
                  isActief: { type: 'boolean' }
                }
              }
            }
          }
        }
      }
    }
  }, rechtController.getRechten.bind(rechtController));

  // Haal rechten per rol op
  fastify.get('/rollen/:rol/rechten', {
    schema: {
      tags: ['Rechten'],
      summary: 'Haal rechten per rol op',
      description: 'Haal alle rechten op die bij een specifieke rol horen',
      params: {
        type: 'object',
        required: ['rol'],
        properties: {
          rol: { 
            type: 'string',
            enum: ['EIGENAAR', 'BEHEERDER', 'MANAGER', 'LID']
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
                rol: { type: 'string' },
                rechten: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      naam: { type: 'string' },
                      beschrijving: { type: 'string' },
                      categorie: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, rechtController.getRechtenVoorRol.bind(rechtController));

  // Controleer of gebruiker een specifiek recht heeft
  fastify.get('/gebruikers/:gebruikerId/rechten/:rechtNaam', {
    schema: {
      tags: ['Rechten'],
      summary: 'Controleer gebruiker recht',
      description: 'Controleer of een gebruiker een specifiek recht heeft',
      params: {
        type: 'object',
        required: ['gebruikerId', 'rechtNaam'],
        properties: {
          gebruikerId: { type: 'string', format: 'uuid' },
          rechtNaam: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          organisatieId: { type: 'string', format: 'uuid' }
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
                heeftRecht: { type: 'boolean' },
                reden: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, rechtController.controleerRecht.bind(rechtController));

  // Haal alle rechten van gebruiker op
  fastify.get('/gebruikers/:gebruikerId/rechten', {
    schema: {
      tags: ['Rechten'],
      summary: 'Haal gebruiker rechten op',
      description: 'Haal alle rechten op die een gebruiker heeft binnen een organisatie',
      params: {
        type: 'object',
        required: ['gebruikerId'],
        properties: {
          gebruikerId: { type: 'string', format: 'uuid' }
        }
      },
      querystring: {
        type: 'object',
        required: ['organisatieId'],
        properties: {
          organisatieId: { type: 'string', format: 'uuid' }
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
                gebruikerId: { type: 'string' },
                organisatieId: { type: 'string' },
                rol: { type: 'string' },
                rechten: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      naam: { type: 'string' },
                      beschrijving: { type: 'string' },
                      categorie: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, rechtController.getGebruikerRechten.bind(rechtController));
}
