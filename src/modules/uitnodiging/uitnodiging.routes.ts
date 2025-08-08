import { FastifyInstance } from 'fastify';
import { UitnodigingController } from './uitnodiging.controller.js';
import { UitnodigingService } from './uitnodiging.service.js';
import {
  maakUitnodigingJsonSchema,
  beantwoordUitnodigingJsonSchema,
  uitnodigingParamsJsonSchema,
  uitnodigingTokenParamsJsonSchema,
  uitnodigingQueryJsonSchema
} from './uitnodiging.schema.js';
import { authenticate } from '../../shared/middlewares/auth';

export async function uitnodigingRoutes(fastify: FastifyInstance) {
  // Initialize services
  const uitnodigingService = new UitnodigingService(fastify.prisma);
  const uitnodigingController = new UitnodigingController(uitnodigingService);

  // Apply authentication to protected routes
  fastify.addHook('preHandler', async (request, reply) => {
    // Publieke routes die geen authenticatie vereisen
    const publicRoutes = [
      '/invite/', // GET /uitnodigingen/:token
      '/public/' // GET /uitnodigingen/:token (publieke info)
    ];
    
    const isPublicRoute = publicRoutes.some(route => 
      (request as any).routerPath?.includes(route)
    );
    
    if (!isPublicRoute) {
      await authenticate(request, reply);
    }
  });

  // GET /api/v1/uitnodigingen/:token - Publieke uitnodiging info (geen auth vereist)
  fastify.get('/:token', {
    schema: {
      tags: ['Uitnodigingen'],
      summary: 'Haal publieke uitnodiging informatie op',
      description: 'Haal uitnodiging informatie op voor de acceptance pagina. Geen authenticatie vereist.',
      params: uitnodigingTokenParamsJsonSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                organisatie: {
                  type: 'object',
                  properties: {
                    naam: { type: 'string' },
                    beschrijving: { type: 'string', nullable: true },
                    logo: { type: 'string', nullable: true }
                  }
                },
                uitnodigingGeldig: { type: 'boolean' },
                gebruikerBestaat: { type: 'boolean' },
                rol: { type: 'string', enum: ['EIGENAAR', 'BEHEERDER', 'EDITOR', 'VIEWER'] },
                bericht: { type: 'string', nullable: true },
                verlooptOp: { type: 'string' },
                uitnodiger: {
                  type: 'object',
                  properties: {
                    voornaam: { type: 'string' },
                    tussenvoegsel: { type: 'string', nullable: true },
                    achternaam: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                  code: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, uitnodigingController.getPubliekeUitnodiging.bind(uitnodigingController));

  // POST /api/v1/uitnodigingen/:token/beantwoord - Beantwoord uitnodiging
  fastify.post('/:token/beantwoord', {
    schema: {
      tags: ['Uitnodigingen'],
      summary: 'Beantwoord uitnodiging',
      description: 'Accepteer of wijzer een uitnodiging af. Vereist authenticatie.',
      params: uitnodigingTokenParamsJsonSchema,
      body: beantwoordUitnodigingJsonSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                  code: { type: 'string' }
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
    }
  }, uitnodigingController.beantwoordUitnodiging.bind(uitnodigingController));

  // GET /api/v1/uitnodigingen/:token/quick-accept - Snelle acceptatie
  fastify.get('/:token/quick-accept', {
    schema: {
      tags: ['Uitnodigingen'],
      summary: 'Accepteer uitnodiging snel',
      description: 'Accepteer een uitnodiging direct zonder extra stappen. Voor bestaande gebruikers.',
      params: uitnodigingTokenParamsJsonSchema,
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
        }
      }
    }
  }, uitnodigingController.quickAcceptUitnodiging.bind(uitnodigingController));

  // DELETE /api/v1/uitnodigingen/:id - Intrek uitnodiging
  fastify.delete('/:id', {
    schema: {
      tags: ['Uitnodigingen'],
      summary: 'Intrek uitnodiging',
      description: 'Intrek een openstaande uitnodiging. Alleen voor eigenaar/beheerder.',
      params: uitnodigingParamsJsonSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        403: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, uitnodigingController.intrekUitnodiging.bind(uitnodigingController));
}

// Organisatie-gerelateerde uitnodiging routes
export async function organisatieUitnodigingRoutes(fastify: FastifyInstance) {
  const uitnodigingService = new UitnodigingService(fastify.prisma);
  const uitnodigingController = new UitnodigingController(uitnodigingService);

  // Apply authentication
  fastify.addHook('preHandler', authenticate);

  // POST /api/v1/organisaties/:organisatieId/uitnodigingen - Stuur uitnodiging
  fastify.post('/', {
    schema: {
      tags: ['Organisaties', 'Uitnodigingen'],
      summary: 'Stuur nieuwe uitnodiging',
      description: 'Stuur een uitnodiging naar een e-mailadres voor organisatie lidmaatschap.',
      params: {
        type: 'object',
        properties: {
          organisatieId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          rol: { type: 'string', enum: ['EIGENAAR', 'BEHEERDER', 'EDITOR', 'VIEWER'] },
          bericht: { type: 'string', maxLength: 500 }
        },
        required: ['email', 'rol']
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
                email: { type: 'string' },
                rol: { type: 'string' },
                status: { type: 'string' },
                organisatieId: { type: 'string' },
                message: { type: 'string' }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                  code: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, uitnodigingController.stuurUitnodiging.bind(uitnodigingController));

  // GET /api/v1/organisaties/:organisatieId/uitnodigingen - Haal uitnodigingen op
  fastify.get('/', {
    schema: {
      tags: ['Organisaties', 'Uitnodigingen'],
      summary: 'Haal organisatie uitnodigingen op',
      description: 'Haal alle uitnodigingen van een organisatie op. Alleen voor eigenaar/beheerder.',
      params: {
        type: 'object',
        properties: {
          organisatieId: { type: 'string', format: 'uuid' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'] },
          limit: { type: 'string', pattern: '^\\d+$', default: '20' },
          offset: { type: 'string', pattern: '^\\d+$', default: '0' }
        }
      },
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
                  email: { type: 'string' },
                  rol: { type: 'string' },
                  status: { type: 'string' },
                  aangemaaktOp: { type: 'string' },
                  verlooptOp: { type: 'string' },
                  organisatie: {
                    type: 'object',
                    properties: {
                      naam: { type: 'string' },
                      logo: { type: 'string', nullable: true }
                    }
                  },
                  uitnodiger: {
                    type: 'object',
                    properties: {
                      voornaam: { type: 'string' },
                      tussenvoegsel: { type: 'string', nullable: true },
                      achternaam: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, uitnodigingController.getOrganisatieUitnodigingen.bind(uitnodigingController));
}

// Gebruiker-gerelateerde uitnodiging routes
export async function gebruikerUitnodigingRoutes(fastify: FastifyInstance) {
  const uitnodigingService = new UitnodigingService(fastify.prisma);
  const uitnodigingController = new UitnodigingController(uitnodigingService);

  // Apply authentication
  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/gebruikers/uitnodigingen - Mijn uitnodigingen
  fastify.get('/uitnodigingen', {
    schema: {
      tags: ['Gebruikers', 'Uitnodigingen'],
      summary: 'Haal mijn uitnodigingen op',
      description: 'Haal alle openstaande uitnodigingen voor de huidige gebruiker op.',
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
                  rol: { type: 'string', enum: ['EIGENAAR', 'BEHEERDER', 'EDITOR', 'VIEWER'] },
                  status: { type: 'string' },
                  bericht: { type: 'string', nullable: true },
                  aangemaaktOp: { type: 'string' },
                  verlooptOp: { type: 'string' },
                  organisatie: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      naam: { type: 'string' },
                      beschrijving: { type: 'string', nullable: true },
                      logo: { type: 'string', nullable: true }
                    }
                  },
                  uitnodiger: {
                    type: 'object',
                    properties: {
                      voornaam: { type: 'string' },
                      tussenvoegsel: { type: 'string', nullable: true },
                      achternaam: { type: 'string' },
                      email: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, uitnodigingController.getMijnUitnodigingen.bind(uitnodigingController));
}
