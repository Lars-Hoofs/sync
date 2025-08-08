import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GroepController } from './groep.controller.js';
import { authenticate } from '../../shared/middlewares/auth.js';

export default async function groepRoutes(fastify: FastifyInstance) {
  const groepController = new GroepController(fastify.prisma);

  // Middleware voor alle groep routes
  fastify.addHook('onRequest', authenticate);

  // Maak nieuwe groep
  fastify.post('/groepen', {
    schema: {
      tags: ['Groepen'],
      summary: 'Maak nieuwe groep aan',
      description: 'Maak een nieuwe gebruikersgroep aan binnen een organisatie',
      body: {
        type: 'object',
        required: ['organisatieId', 'naam'],
        properties: {
          organisatieId: { type: 'string', format: 'uuid' },
          naam: { type: 'string', minLength: 1, maxLength: 100 },
          beschrijving: { type: 'string', maxLength: 500 }
        }
      },
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
                beschrijving: { type: 'string' },
                organisatieId: { type: 'string' },
                aantalLeden: { type: 'integer' },
                aangemaaktOp: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  }, groepController.maakGroep.bind(groepController));

  // Haal alle groepen op
  fastify.get('/groepen', {
    schema: {
      tags: ['Groepen'],
      summary: 'Haal alle groepen op',
      description: 'Haal alle groepen op waar de gebruiker toegang toe heeft',
      querystring: {
        type: 'object',
        properties: {
          organisatieId: { type: 'string', format: 'uuid' },
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
                groepen: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      naam: { type: 'string' },
                      beschrijving: { type: 'string' },
                      organisatieId: { type: 'string' },
                      aantalLeden: { type: 'integer' },
                      aangemaaktOp: { type: 'string', format: 'date-time' }
                    }
                  }
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
  }, groepController.getGroepen.bind(groepController));

  // Haal specifieke groep op
  fastify.get('/groepen/:groepId', {
    schema: {
      tags: ['Groepen'],
      summary: 'Haal groep op',
      description: 'Haal een specifieke groep op met alle leden',
      params: {
        type: 'object',
        required: ['groepId'],
        properties: {
          groepId: { type: 'string', format: 'uuid' }
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
                id: { type: 'string' },
                naam: { type: 'string' },
                beschrijving: { type: 'string' },
                organisatieId: { type: 'string' },
                aangemaaktOp: { type: 'string', format: 'date-time' },
                leden: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      voornaam: { type: 'string' },
                      tussenvoegsel: { type: 'string' },
                      achternaam: { type: 'string' },
                      email: { type: 'string' },
                      rol: { type: 'string' },
                      toegevoegdOp: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, groepController.getGroepById.bind(groepController));

  // Update groep
  fastify.put('/groepen/:groepId', {
    schema: {
      tags: ['Groepen'],
      summary: 'Update groep',
      description: 'Update een bestaande groep',
      params: {
        type: 'object',
        required: ['groepId'],
        properties: {
          groepId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          naam: { type: 'string', minLength: 1, maxLength: 100 },
          beschrijving: { type: 'string', maxLength: 500 }
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
  }, groepController.updateGroep.bind(groepController));

  // Verwijder groep
  fastify.delete('/groepen/:groepId', {
    schema: {
      tags: ['Groepen'],
      summary: 'Verwijder groep',
      description: 'Verwijder een groep permanent',
      params: {
        type: 'object',
        required: ['groepId'],
        properties: {
          groepId: { type: 'string', format: 'uuid' }
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
  }, groepController.verwijderGroep.bind(groepController));

  // Voeg leden toe aan groep
  fastify.post('/groepen/:groepId/leden', {
    schema: {
      tags: ['Groepen'],
      summary: 'Voeg leden toe',
      description: 'Voeg gebruikers toe aan een groep',
      params: {
        type: 'object',
        required: ['groepId'],
        properties: {
          groepId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['gebruikerIds'],
        properties: {
          gebruikerIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            minItems: 1
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            toegevoegd: { type: 'integer' }
          }
        }
      }
    }
  }, groepController.voegLedenToe.bind(groepController));

  // Verwijder lid uit groep
  fastify.delete('/groepen/:groepId/leden/:gebruikerId', {
    schema: {
      tags: ['Groepen'],
      summary: 'Verwijder lid',
      description: 'Verwijder een gebruiker uit een groep',
      params: {
        type: 'object',
        required: ['groepId', 'gebruikerId'],
        properties: {
          groepId: { type: 'string', format: 'uuid' },
          gebruikerId: { type: 'string', format: 'uuid' }
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
  }, groepController.verwijderLid.bind(groepController));
}
