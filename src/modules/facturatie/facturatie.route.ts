import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { FacturatieController } from './facturatie.controller.js';
import { authenticate } from '../../shared/middlewares/auth.js';

export default async function facturatieRoutes(fastify: FastifyInstance) {
  const facturatieController = new FacturatieController(fastify.prisma);

  // Middleware voor alle facturatie routes
  fastify.addHook('onRequest', authenticate);

  // Haal organisatie abonnement op
  fastify.get('/organisaties/:organisatieId/abonnement', {
    schema: {
      tags: ['Facturatie'],
      summary: 'Haal organisatie abonnement op',
      description: 'Haal het huidige abonnement van een organisatie op',
      params: {
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
                id: { type: 'string' },
                plan: { 
                  type: 'string',
                  enum: ['GRATIS', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']
                },
                status: { 
                  type: 'string',
                  enum: ['ACTIEF', 'VERVALLEN', 'GEANNULEERD', 'PROEFTIJD']
                },
                startDatum: { type: 'string', format: 'date-time' },
                eindDatum: { type: 'string', format: 'date-time' },
                limiet: {
                  type: 'object',
                  properties: {
                    chatbots: { type: 'integer' },
                    berichten: { type: 'integer' },
                    gebruikers: { type: 'integer' }
                  }
                },
                gebruik: {
                  type: 'object',
                  properties: {
                    chatbots: { type: 'integer' },
                    berichten: { type: 'integer' },
                    gebruikers: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, facturatieController.getAbonnement.bind(facturatieController));

  // Haal alle facturen op
  fastify.get('/organisaties/:organisatieId/facturen', {
    schema: {
      tags: ['Facturatie'],
      summary: 'Haal facturen op',
      description: 'Haal alle facturen van een organisatie op',
      params: {
        type: 'object',
        required: ['organisatieId'],
        properties: {
          organisatieId: { type: 'string', format: 'uuid' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          status: { 
            type: 'string',
            enum: ['CONCEPT', 'VERZONDEN', 'BETAALD', 'ACHTERSTALLIG', 'GEANNULEERD']
          },
          van: { type: 'string', format: 'date' },
          tot: { type: 'string', format: 'date' },
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
                facturen: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      factuurnummer: { type: 'string' },
                      bedrag: { type: 'number' },
                      btw: { type: 'number' },
                      totaalBedrag: { type: 'number' },
                      status: { type: 'string' },
                      factuurdatum: { type: 'string', format: 'date' },
                      vervaldatum: { type: 'string', format: 'date' },
                      periode: {
                        type: 'object',
                        properties: {
                          van: { type: 'string', format: 'date' },
                          tot: { type: 'string', format: 'date' }
                        }
                      }
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
  }, facturatieController.getFacturen.bind(facturatieController));

  // Haal specifieke factuur op
  fastify.get('/organisaties/:organisatieId/facturen/:factuurId', {
    schema: {
      tags: ['Facturatie'],
      summary: 'Haal factuur op',
      description: 'Haal een specifieke factuur op met alle details',
      params: {
        type: 'object',
        required: ['organisatieId', 'factuurId'],
        properties: {
          organisatieId: { type: 'string', format: 'uuid' },
          factuurId: { type: 'string', format: 'uuid' }
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
                factuurnummer: { type: 'string' },
                bedrag: { type: 'number' },
                btw: { type: 'number' },
                totaalBedrag: { type: 'number' },
                status: { type: 'string' },
                factuurdatum: { type: 'string', format: 'date' },
                vervaldatum: { type: 'string', format: 'date' },
                regels: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      beschrijving: { type: 'string' },
                      aantal: { type: 'integer' },
                      prijs: { type: 'number' },
                      totaal: { type: 'number' }
                    }
                  }
                },
                betaalLink: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, facturatieController.getFactuurById.bind(facturatieController));

  // Download factuur PDF
  fastify.get('/organisaties/:organisatieId/facturen/:factuurId/download', {
    schema: {
      tags: ['Facturatie'],
      summary: 'Download factuur PDF',
      description: 'Download een factuur als PDF bestand',
      params: {
        type: 'object',
        required: ['organisatieId', 'factuurId'],
        properties: {
          organisatieId: { type: 'string', format: 'uuid' },
          factuurId: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        200: {
          type: 'string',
          format: 'binary'
        }
      }
    }
  }, facturatieController.downloadFactuurPDF.bind(facturatieController));

  // Wijzig abonnement
  fastify.put('/organisaties/:organisatieId/abonnement', {
    schema: {
      tags: ['Facturatie'],
      summary: 'Wijzig abonnement',
      description: 'Wijzig het abonnement van een organisatie',
      params: {
        type: 'object',
        required: ['organisatieId'],
        properties: {
          organisatieId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['plan'],
        properties: {
          plan: { 
            type: 'string',
            enum: ['GRATIS', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']
          },
          facturatieAdres: {
            type: 'object',
            properties: {
              bedrijf: { type: 'string' },
              adresRegel1: { type: 'string' },
              adresRegel2: { type: 'string' },
              postcode: { type: 'string' },
              plaats: { type: 'string' },
              land: { type: 'string' },
              btwNummer: { type: 'string' }
            }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                plan: { type: 'string' },
                wijzigingsDatum: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  }, facturatieController.wijzigAbonnement.bind(facturatieController));

  // Haal gebruiksstatistieken op
  fastify.get('/organisaties/:organisatieId/gebruik', {
    schema: {
      tags: ['Facturatie'],
      summary: 'Haal gebruik op',
      description: 'Haal huidige gebruiksstatistieken van een organisatie op',
      params: {
        type: 'object',
        required: ['organisatieId'],
        properties: {
          organisatieId: { type: 'string', format: 'uuid' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          periode: { 
            type: 'string',
            enum: ['MAAND', 'KWARTAAL', 'JAAR'],
            default: 'MAAND'
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
                periode: {
                  type: 'object',
                  properties: {
                    van: { type: 'string', format: 'date' },
                    tot: { type: 'string', format: 'date' }
                  }
                },
                limiet: {
                  type: 'object',
                  properties: {
                    chatbots: { type: 'integer' },
                    berichten: { type: 'integer' },
                    gebruikers: { type: 'integer' }
                  }
                },
                gebruik: {
                  type: 'object',
                  properties: {
                    chatbots: { type: 'integer' },
                    berichten: { type: 'integer' },
                    gebruikers: { type: 'integer' }
                  }
                },
                percentage: {
                  type: 'object',
                  properties: {
                    chatbots: { type: 'number' },
                    berichten: { type: 'number' },
                    gebruikers: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, facturatieController.getGebruik.bind(facturatieController));
}
