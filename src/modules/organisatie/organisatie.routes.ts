import { FastifyInstance } from 'fastify';
import { OrganisatieController } from './organisatie.controller.js';
import { OrganisatieService } from './organisatie.service.js';
import {
  maakOrganisatieJsonSchema,
  updateOrganisatieJsonSchema,
  wijzigLidRolJsonSchema,
  organisatieParamsJsonSchema,
  lidmaatschapParamsJsonSchema
} from './organisatie.schema.js';
import { authenticate } from '../../shared/middlewares/auth';

export async function organisatieRoutes(fastify: FastifyInstance) {
  // Initialize services
  const organisatieService = new OrganisatieService(fastify.prisma);
  const organisatieController = new OrganisatieController(organisatieService);

  // Apply authentication to all routes
  fastify.addHook('preHandler', authenticate);

  // POST /api/v1/organisaties - Maak nieuwe organisatie
  fastify.post('/', {
    schema: {
      tags: ['Organisaties'],
      summary: 'Maak nieuwe organisatie aan',
      description: 'Maak een nieuwe organisatie aan. De gebruiker wordt automatisch eigenaar.',
      body: maakOrganisatieJsonSchema,
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
                beschrijving: { type: 'string', nullable: true },
                website: { type: 'string', nullable: true },
                telefoonnummer: { type: 'string', nullable: true },
                adres: { type: 'string', nullable: true },
                logo: { type: 'string', nullable: true },
                eigenaarId: { type: 'string' },
                aangemaaktOp: { type: 'string' },
                bijgewerktOp: { type: 'string' }
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
  }, organisatieController.maakOrganisatie.bind(organisatieController));

  // GET /api/v1/organisaties/:id - Haal organisatie op
  fastify.get('/:id', {
    schema: {
      tags: ['Organisaties'],
      summary: 'Haal organisatie op',
      description: 'Haal een specifieke organisatie op. Alleen toegankelijk voor leden.',
      params: organisatieParamsJsonSchema,
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
                beschrijving: { type: 'string', nullable: true },
                website: { type: 'string', nullable: true },
                telefoonnummer: { type: 'string', nullable: true },
                adres: { type: 'string', nullable: true },
                logo: { type: 'string', nullable: true },
                eigenaarId: { type: 'string' },
                aangemaaktOp: { type: 'string' },
                bijgewerktOp: { type: 'string' },
                eigenaar: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    voornaam: { type: 'string' },
                    tussenvoegsel: { type: 'string', nullable: true },
                    achternaam: { type: 'string' },
                    email: { type: 'string' }
                  }
                },
                _count: {
                  type: 'object',
                  properties: {
                    leden: { type: 'number' },
                    chatbots: { type: 'number' }
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
  }, organisatieController.getOrganisatie.bind(organisatieController));

  // PUT /api/v1/organisaties/:id - Update organisatie
  fastify.put('/:id', {
    schema: {
      tags: ['Organisaties'],
      summary: 'Update organisatie',
      description: 'Update een organisatie. Alleen toegankelijk voor eigenaar en beheerders.',
      params: organisatieParamsJsonSchema,
      body: updateOrganisatieJsonSchema,
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
                beschrijving: { type: 'string', nullable: true },
                website: { type: 'string', nullable: true },
                telefoonnummer: { type: 'string', nullable: true },
                adres: { type: 'string', nullable: true },
                logo: { type: 'string', nullable: true },
                eigenaarId: { type: 'string' },
                aangemaaktOp: { type: 'string' },
                bijgewerktOp: { type: 'string' }
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
  }, organisatieController.updateOrganisatie.bind(organisatieController));

  // GET /api/v1/organisaties/:id/leden - Haal organisatie leden op
  fastify.get('/:id/leden', {
    schema: {
      tags: ['Organisaties'],
      summary: 'Haal organisatie leden op',
      description: 'Haal alle leden van een organisatie op. Alleen toegankelijk voor leden.',
      params: organisatieParamsJsonSchema,
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
                  gebruikerId: { type: 'string' },
                  rol: {
                    type: 'string',
                    enum: ['EIGENAAR', 'BEHEERDER', 'EDITOR', 'VIEWER']
                  },
                  aangemaaktOp: { type: 'string' },
                  gebruiker: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      voornaam: { type: 'string' },
                      tussenvoegsel: { type: 'string', nullable: true },
                      achternaam: { type: 'string' },
                      email: { type: 'string' },
                      profielFoto: { type: 'string', nullable: true }
                    }
                  }
                }
              }
            }
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
  }, organisatieController.getOrganisatieLeden.bind(organisatieController));

  // PATCH /api/v1/organisaties/:id/leden/:lidmaatschapId/rol - Wijzig lid rol
  fastify.patch('/:id/leden/:lidmaatschapId/rol', {
    schema: {
      tags: ['Organisaties'],
      summary: 'Wijzig rol van lid',
      description: 'Wijzig de rol van een lid binnen de organisatie. Alleen toegankelijk voor eigenaar en beheerders.',
      params: lidmaatschapParamsJsonSchema,
      body: wijzigLidRolJsonSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                gebruikerId: { type: 'string' },
                rol: {
                  type: 'string',
                  enum: ['EIGENAAR', 'BEHEERDER', 'EDITOR', 'VIEWER']
                },
                bijgewerktOp: { type: 'string' }
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
  }, organisatieController.wijzigLidRol.bind(organisatieController));

  // DELETE /api/v1/organisaties/:id/leden/:lidmaatschapId - Verwijder lid
  fastify.delete('/:id/leden/:lidmaatschapId', {
    schema: {
      tags: ['Organisaties'],
      summary: 'Verwijder lid uit organisatie',
      description: 'Verwijder een lid uit de organisatie. Alleen toegankelijk voor eigenaar en beheerders.',
      params: lidmaatschapParamsJsonSchema,
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
        403: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, organisatieController.verwijderLid.bind(organisatieController));
}

// Extra route voor gebruiker organisaties (in gebruiker routes)
export async function gebruikerOrganisatieRoutes(fastify: FastifyInstance) {
  const organisatieService = new OrganisatieService(fastify.prisma);
  const organisatieController = new OrganisatieController(organisatieService);

  // Apply authentication
  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/gebruikers/organisaties - Haal mijn organisaties op
  fastify.get('/organisaties', {
    schema: {
      tags: ['Gebruikers'],
      summary: 'Haal mijn organisaties op',
      description: 'Haal alle organisaties op waar de huidige gebruiker lid van is.',
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
                  beschrijving: { type: 'string', nullable: true },
                  website: { type: 'string', nullable: true },
                  logo: { type: 'string', nullable: true },
                  eigenaarId: { type: 'string' },
                  aangemaaktOp: { type: 'string' },
                  mijnRol: {
                    type: 'string',
                    enum: ['EIGENAAR', 'BEHEERDER', 'EDITOR', 'VIEWER']
                  },
                  lidSinds: { type: 'string' },
                  eigenaar: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
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
  }, organisatieController.getMijnOrganisaties.bind(organisatieController));
}
