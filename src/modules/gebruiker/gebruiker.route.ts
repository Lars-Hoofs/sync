import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { GebruikerController } from './gebruiker.controller.js';
import { GebruikerService } from './gebruiker.service.js';
import { 
  registratieJsonSchema,
  loginJsonSchema,
  updateProfielJsonSchema,
  wijzigWachtwoordJsonSchema,
  gebruikerResponseJsonSchema,
  loginResponseJsonSchema
} from './gebruiker.schema.js';

export default async function gebruikerRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  const gebruikerService = new GebruikerService(fastify.prisma);
  const gebruikerController = new GebruikerController(gebruikerService);

  // Auth routes
  fastify.post('/auth/register', {
    schema: {
      tags: ['Authenticatie'],
      summary: 'Registreer nieuwe gebruiker',
      description: 'Maak een nieuw gebruikersaccount aan',
      body: registratieJsonSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: gebruikerResponseJsonSchema,
            message: { type: 'string', example: 'Account succesvol aangemaakt' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
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
    },
    handler: gebruikerController.registreer.bind(gebruikerController)
  });

  fastify.post('/auth/login', {
    schema: {
      tags: ['Authenticatie'],
      summary: 'Login gebruiker',
      description: 'Authenticeer gebruiker met email en wachtwoord',
      body: loginJsonSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: loginResponseJsonSchema,
            message: { type: 'string', example: 'Login succesvol' }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
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
    },
    handler: gebruikerController.login.bind(gebruikerController)
  });

  fastify.post('/auth/logout', {
    schema: {
      tags: ['Authenticatie'],
      summary: 'Logout gebruiker',
      description: 'Log gebruiker uit en invalideer sessie',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Succesvol uitgelogd' }
          }
        }
      }
    },
    handler: gebruikerController.logout.bind(gebruikerController)
  });

  // User profile routes (require authentication)
  fastify.get('/gebruikers/profiel', {
    schema: {
      tags: ['Gebruikers'],
      summary: 'Haal gebruiker profiel op',
      description: 'Haal het profiel van de ingelogde gebruiker op',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                ...gebruikerResponseJsonSchema.properties,
                organisaties: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      naam: { type: 'string' },
                      slug: { type: 'string' },
                      rol: { 
                        type: 'string',
                        enum: ['EIGENAAR', 'BEHEERDER', 'MANAGER', 'LID']
                      }
                    }
                  }
                },
                tweeFABackupCodesCount: { type: 'number' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' }
          }
        }
      }
    },
    // preHandler: [fastify.authenticate], // TODO: Add authentication middleware
    handler: gebruikerController.getProfiel.bind(gebruikerController)
  });

  fastify.put('/gebruikers/profiel', {
    schema: {
      tags: ['Gebruikers'],
      summary: 'Update gebruiker profiel',
      description: 'Werk het profiel van de ingelogde gebruiker bij',
      security: [{ bearerAuth: [] }],
      body: updateProfielJsonSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: gebruikerResponseJsonSchema,
            message: { type: 'string', example: 'Profiel succesvol bijgewerkt' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
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
            success: { type: 'boolean', example: false },
            message: { type: 'string' }
          }
        }
      }
    },
    // preHandler: [fastify.authenticate], // TODO: Add authentication middleware
    handler: gebruikerController.updateProfiel.bind(gebruikerController)
  });

  fastify.post('/gebruikers/wachtwoord-wijzigen', {
    schema: {
      tags: ['Gebruikers'],
      summary: 'Wijzig wachtwoord',
      description: 'Wijzig het wachtwoord van de ingelogde gebruiker',
      security: [{ bearerAuth: [] }],
      body: wijzigWachtwoordJsonSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Wachtwoord succesvol gewijzigd' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
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
            success: { type: 'boolean', example: false },
            message: { type: 'string' }
          }
        }
      }
    },
    // preHandler: [fastify.authenticate], // TODO: Add authentication middleware
    handler: gebruikerController.wijzigWachtwoord.bind(gebruikerController)
  });

  // 2FA routes
  fastify.post('/gebruikers/2fa/enable', {
    schema: {
      tags: ['2FA'],
      summary: 'Schakel 2FA in',
      description: 'Schakel two-factor authenticatie in voor de gebruiker',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                secret: { 
                  type: 'string', 
                  description: 'TOTP secret voor authenticator app' 
                },
                qrCodeUri: { 
                  type: 'string', 
                  description: 'QR code URI voor authenticator app' 
                },
                backupCodes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Backup codes voor herstel'
                }
              }
            },
            message: { type: 'string', example: '2FA succesvol ingeschakeld' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' }
          }
        }
      }
    },
    // preHandler: [fastify.authenticate], // TODO: Add authentication middleware
    handler: gebruikerController.schakel2FAIn.bind(gebruikerController)
  });
}
