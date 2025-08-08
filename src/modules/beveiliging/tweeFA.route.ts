import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TweeFAController } from './tweeFA.controller';
import { authenticate } from '../../shared/middlewares/auth.js';

export default async function tweeFARoutes(fastify: FastifyInstance) {
  const tweeFAController = new TweeFAController(fastify.prisma);

  // Middleware voor alle 2FA routes
  fastify.addHook('onRequest', authenticate);

  // Schakel 2FA in
  fastify.post('/beveiliging/2fa/inschakelen', {
    schema: {
      tags: ['2FA'],
      summary: 'Schakel 2FA in',
      description: 'Schakel Two-Factor Authentication in voor de gebruiker',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                secret: { type: 'string' },
                qrCodeUri: { type: 'string' },
                backupCodes: {
                  type: 'array',
                  items: { type: 'string' }
                },
                message: { type: 'string' }
              }
            }
          }
        },
        400: { $ref: 'ErrorResponse' },
        409: { $ref: 'ErrorResponse' }
      }
    }
  }, tweeFAController.schakel2FAIn.bind(tweeFAController));

  // Verifieer en bevestig 2FA setup
  fastify.post('/beveiliging/2fa/bevestigen', {
    schema: {
      tags: ['2FA'],
      summary: 'Bevestig 2FA setup',
      description: 'Bevestig de 2FA setup door een TOTP code in te voeren',
      body: {
        type: 'object',
        required: ['totpCode'],
        properties: {
          totpCode: { 
            type: 'string', 
            pattern: '^[0-9]{6}$',
            description: '6-cijferige TOTP code'
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
        },
        400: { $ref: 'ErrorResponse' },
        401: { $ref: 'ErrorResponse' }
      }
    }
  }, tweeFAController.bevestig2FA.bind(tweeFAController));

  // Schakel 2FA uit
  fastify.post('/beveiliging/2fa/uitschakelen', {
    schema: {
      tags: ['2FA'],
      summary: 'Schakel 2FA uit',
      description: 'Schakel Two-Factor Authentication uit voor de gebruiker',
      body: {
        type: 'object',
        required: ['wachtwoord'],
        properties: {
          wachtwoord: { type: 'string' },
          totpCode: { 
            type: 'string', 
            pattern: '^[0-9]{6}$',
            description: '6-cijferige TOTP code of backup code'
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
        },
        400: { $ref: 'ErrorResponse' },
        401: { $ref: 'ErrorResponse' }
      }
    }
  }, tweeFAController.schakel2FAUit.bind(tweeFAController));

  // Genereer nieuwe backup codes
  fastify.post('/beveiliging/2fa/backup-codes/regenereren', {
    schema: {
      tags: ['2FA'],
      summary: 'Genereer nieuwe backup codes',
      description: 'Genereer nieuwe backup codes voor 2FA (oude codes worden ongeldig)',
      body: {
        type: 'object',
        required: ['wachtwoord', 'totpCode'],
        properties: {
          wachtwoord: { type: 'string' },
          totpCode: { 
            type: 'string', 
            pattern: '^[0-9]{6}$',
            description: '6-cijferige TOTP code'
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
                backupCodes: {
                  type: 'array',
                  items: { type: 'string' }
                },
                message: { type: 'string' }
              }
            }
          }
        },
        400: { $ref: 'ErrorResponse' },
        401: { $ref: 'ErrorResponse' }
      }
    }
  }, tweeFAController.regenereerBackupCodes.bind(tweeFAController));

  // Haal 2FA status op
  fastify.get('/beveiliging/2fa/status', {
    schema: {
      tags: ['2FA'],
      summary: 'Haal 2FA status op',
      description: 'Haal de huidige 2FA status van de gebruiker op',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                is2FAIngeschakeld: { type: 'boolean' },
                heeftBackupCodes: { type: 'boolean' },
                aantalBackupCodes: { type: 'integer' },
                laatsteGebruiktOp: { 
                  type: ['string', 'null'], 
                  format: 'date-time' 
                }
              }
            }
          }
        }
      }
    }
  }, tweeFAController.get2FAStatus.bind(tweeFAController));

  // Verifieer 2FA code (voor administratieve acties)
  fastify.post('/beveiliging/2fa/verifieer', {
    schema: {
      tags: ['2FA'],
      summary: 'Verifieer 2FA code',
      description: 'Verifieer een 2FA code voor gevoelige acties',
      body: {
        type: 'object',
        required: ['totpCode'],
        properties: {
          totpCode: { 
            type: 'string', 
            pattern: '^[0-9]{6,8}$',
            description: '6-cijferige TOTP code of 8-cijferige backup code'
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
                geldig: { type: 'boolean' },
                type: { 
                  type: 'string',
                  enum: ['TOTP', 'BACKUP']
                }
              }
            }
          }
        },
        400: { $ref: 'ErrorResponse' },
        401: { $ref: 'ErrorResponse' }
      }
    }
  }, tweeFAController.verifieer2FACode.bind(tweeFAController));
}
