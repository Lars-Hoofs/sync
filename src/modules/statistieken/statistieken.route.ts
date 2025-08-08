import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatistiekenController } from './statistieken.controller.js';
import { authenticate } from '../../shared/middlewares/auth.js';

export default async function statistiekenRoutes(fastify: FastifyInstance) {
  const statistiekenController = new StatistiekenController(fastify.prisma);

  // Middleware voor alle statistieken routes
  fastify.addHook('onRequest', authenticate);

  // Dashboard statistieken
  fastify.get('/statistieken/dashboard', {
    schema: {
      tags: ['Statistieken'],
      summary: 'Dashboard statistieken',
      description: 'Haal hoofdstatistieken op voor het dashboard',
      querystring: {
        type: 'object',
        properties: {
          organisatieId: { type: 'string', format: 'uuid' },
          periode: { 
            type: 'string',
            enum: ['DAG', 'WEEK', 'MAAND', 'KWARTAAL', 'JAAR'],
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
                overzicht: {
                  type: 'object',
                  properties: {
                    totaleChatbots: { type: 'integer' },
                    totaleGesprekken: { type: 'integer' },
                    totaleBerichten: { type: 'integer' },
                    activeGebruikers: { type: 'integer' },
                    gemiddeldeTevredenheid: { type: 'number' }
                  }
                },
                trends: {
                  type: 'object',
                  properties: {
                    gesprekken: {
                      type: 'object',
                      properties: {
                        waarde: { type: 'integer' },
                        verandering: { type: 'number' },
                        trend: { type: 'string', enum: ['STIJGEND', 'DALEND', 'STABIEL'] }
                      }
                    },
                    berichten: {
                      type: 'object',
                      properties: {
                        waarde: { type: 'integer' },
                        verandering: { type: 'number' },
                        trend: { type: 'string', enum: ['STIJGEND', 'DALEND', 'STABIEL'] }
                      }
                    },
                    tevredenheid: {
                      type: 'object',
                      properties: {
                        waarde: { type: 'number' },
                        verandering: { type: 'number' },
                        trend: { type: 'string', enum: ['STIJGEND', 'DALEND', 'STABIEL'] }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, statistiekenController.getDashboardStats.bind(statistiekenController));

  // Chatbot statistieken
  fastify.get('/statistieken/chatbots', {
    schema: {
      tags: ['Statistieken'],
      summary: 'Chatbot statistieken',
      description: 'Haal gedetailleerde statistieken per chatbot op',
      querystring: {
        type: 'object',
        properties: {
          organisatieId: { type: 'string', format: 'uuid' },
          chatbotId: { type: 'string', format: 'uuid' },
          van: { type: 'string', format: 'date' },
          tot: { type: 'string', format: 'date' }
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
                  chatbotId: { type: 'string' },
                  chatbotNaam: { type: 'string' },
                  statistics: {
                    type: 'object',
                    properties: {
                      totalGesprekken: { type: 'integer' },
                      totalBerichten: { type: 'integer' },
                      gemiddeldeGesprekDuur: { type: 'number' },
                      opgelosteVragen: { type: 'integer' },
                      doorverwezenVragen: { type: 'integer' },
                      tevredenheidscore: { type: 'number' },
                      topVragen: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            vraag: { type: 'string' },
                            aantal: { type: 'integer' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, statistiekenController.getChatbotStats.bind(statistiekenController));

  // Gebruikersstatistieken
  fastify.get('/statistieken/gebruikers', {
    schema: {
      tags: ['Statistieken'],
      summary: 'Gebruikersstatistieken',
      description: 'Haal statistieken over gebruikersactiviteit op',
      querystring: {
        type: 'object',
        properties: {
          organisatieId: { type: 'string', format: 'uuid' },
          van: { type: 'string', format: 'date' },
          tot: { type: 'string', format: 'date' }
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
                totaleGebruikers: { type: 'integer' },
                activeGebruikers: { type: 'integer' },
                nieuweGebruikers: { type: 'integer' },
                activiteitPerDag: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      datum: { type: 'string', format: 'date' },
                      actieveGebruikers: { type: 'integer' },
                      aantalSessies: { type: 'integer' }
                    }
                  }
                },
                topGebruikers: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      gebruikerId: { type: 'string' },
                      naam: { type: 'string' },
                      aantalSessies: { type: 'integer' },
                      laatsteActiviteit: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, statistiekenController.getGebruikersStats.bind(statistiekenController));

  // Conversatie trends
  fastify.get('/statistieken/conversaties/trends', {
    schema: {
      tags: ['Statistieken'],
      summary: 'Conversatie trends',
      description: 'Haal trends in conversaties over tijd op',
      querystring: {
        type: 'object',
        properties: {
          organisatieId: { type: 'string', format: 'uuid' },
          chatbotId: { type: 'string', format: 'uuid' },
          periode: { 
            type: 'string',
            enum: ['UUR', 'DAG', 'WEEK', 'MAAND'],
            default: 'DAG'
          },
          van: { type: 'string', format: 'date' },
          tot: { type: 'string', format: 'date' }
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
                periode: { type: 'string' },
                datapunten: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tijdstip: { type: 'string' },
                      gesprekken: { type: 'integer' },
                      berichten: { type: 'integer' },
                      gemiddeldeDuur: { type: 'number' },
                      tevredenheid: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, statistiekenController.getConversatieTrends.bind(statistiekenController));

  // Export statistieken
  fastify.post('/statistieken/export', {
    schema: {
      tags: ['Statistieken'],
      summary: 'Exporteer statistieken',
      description: 'Exporteer statistieken naar CSV of Excel formaat',
      body: {
        type: 'object',
        required: ['type', 'formaat'],
        properties: {
          type: {
            type: 'string',
            enum: ['DASHBOARD', 'CHATBOTS', 'GEBRUIKERS', 'CONVERSATIES']
          },
          formaat: {
            type: 'string',
            enum: ['CSV', 'EXCEL']
          },
          filters: {
            type: 'object',
            properties: {
              organisatieId: { type: 'string', format: 'uuid' },
              chatbotId: { type: 'string', format: 'uuid' },
              van: { type: 'string', format: 'date' },
              tot: { type: 'string', format: 'date' }
            }
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
                downloadUrl: { type: 'string' },
                bestandsnaam: { type: 'string' },
                verlooptOp: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  }, statistiekenController.exporteerStatistieken.bind(statistiekenController));

  // Real-time statistieken (voor live dashboard updates)
  fastify.get('/statistieken/realtime', {
    schema: {
      tags: ['Statistieken'],
      summary: 'Real-time statistieken',
      description: 'Haal live statistieken op voor dashboard updates',
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
                timestamp: { type: 'string', format: 'date-time' },
                activeGesprekken: { type: 'integer' },
                berichten24u: { type: 'integer' },
                responseTime: { type: 'number' },
                systemStatus: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ONLINE', 'DEGRADED', 'OFFLINE'] },
                    uptime: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, statistiekenController.getRealTimeStats.bind(statistiekenController));
}
