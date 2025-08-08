import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { ServiceResult, CustomError } from '../../types/common';
import StatistiekService from '../../services/statistiek.service';

export interface DashboardStatistieken {
  totalen: {
    organisaties: number;
    gebruikers: number;
    chatbots: number;
    gesprekken: number;
    berichten: number;
  };
  trends: {
    nieuweGebruikers: Array<{ datum: Date; aantal: number }>;
    actieveOrganisaties: Array<{ datum: Date; aantal: number }>;
    gespreksVolume: Array<{ datum: Date; aantal: number }>;
  };
  topPerformers: {
    actievsteOrganisaties: Array<{
      id: string;
      naam: string;
      aantalChatbots: number;
      aantalGesprekken: number;
    }>;
    populairsteChatbots: Array<{
      id: string;
      naam: string;
      organisatie: string;
      aantalGesprekken: number;
      tevredenheid: number;
    }>;
  };
}

export interface OrganisatieStatistieken {
  organisatieId: string;
  periode: {
    van: Date;
    tot: Date;
  };
  chatbots: {
    totaal: number;
    actief: number;
    inactief: number;
    populairste: Array<{
      id: string;
      naam: string;
      aantalGesprekken: number;
      gemiddeldeTevredenheid: number;
    }>;
  };
  gesprekken: {
    totaal: number;
    afgerond: number;
    actief: number;
    onderbroken: number;
    volumePerDag: Array<{ datum: Date; aantal: number }>;
    gemiddeldeDuur: number;
  };
  berichten: {
    totaal: number;
    vanGebruikers: number;
    vanChatbot: number;
    gemiddeldeResponsTijd: number;
  };
  tevredenheid: {
    gemiddelde: number;
    verdeling: Array<{
      score: number;
      aantal: number;
      percentage: number;
    }>;
  };
  gebruikspatronen: {
    drukstePeriodes: Array<{
      uur: number;
      aantalGesprekken: number;
    }>;
    populairsteVragen: Array<{
      vraag: string;
      aantal: number;
    }>;
  };
}

export class StatistiekenService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Haal dashboard statistieken op (admin)
   */
  async getDashboardStatistieken(gebruikerId: string): Promise<ServiceResult<DashboardStatistieken>> {
    try {
      // Check admin rechten (zou via middleware moeten)
      const gebruiker = await this.prisma.gebruiker.findUnique({
        where: { id: gebruikerId }
      });

      if (!gebruiker || !gebruiker.isAdmin) {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Geen toegang tot dashboard statistieken',
            code: ERROR_CODES.FORBIDDEN,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      const nu = new Date();
      const dertigDagenGeleden = new Date(nu.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Totalen
      const [
        totaalOrganisaties,
        totaalGebruikers,
        totaalChatbots,
        totaalGesprekken,
        totaalBerichten
      ] = await Promise.all([
        this.prisma.organisatie.count(),
        this.prisma.gebruiker.count(),
        this.prisma.chatBot.count(),
        this.prisma.gesprek.count(),
        this.prisma.bericht.count()
      ]);

      // Trends (laatste 30 dagen)
      const nieuweGebruikers = await this.prisma.gebruiker.groupBy({
        by: ['aangemaaktOp'],
        _count: true,
        where: {
          aangemaaktOp: { gte: dertigDagenGeleden }
        }
      });

      const gespreksVolume = await this.prisma.gesprek.groupBy({
        by: ['startTijd'],
        _count: true,
        where: {
          startTijd: { gte: dertigDagenGeleden }
        }
      });

      // Top performers
      const actievsteOrganisaties = await this.prisma.organisatie.findMany({
        include: {
          chatbots: {
            include: {
              gesprekken: {
                where: {
                  startTijd: { gte: dertigDagenGeleden }
                }
              }
            }
          }
        },
        take: 5
      });

      const populairsteChatbots = await this.prisma.chatBot.findMany({
        include: {
          organisatie: { select: { naam: true } },
          gesprekken: {
            where: {
              startTijd: { gte: dertigDagenGeleden }
            }
          }
        },
        take: 10
      });

      const statistieken: DashboardStatistieken = {
        totalen: {
          organisaties: totaalOrganisaties,
          gebruikers: totaalGebruikers,
          chatbots: totaalChatbots,
          gesprekken: totaalGesprekken,
          berichten: totaalBerichten
        },
        trends: {
          nieuweGebruikers: this.groupByDay(nieuweGebruikers, 'aangemaaktOp'),
          actieveOrganisaties: [], // TODO: Implementeer
          gespreksVolume: this.groupByDay(gespreksVolume, 'startTijd')
        },
        topPerformers: {
          actievsteOrganisaties: actievsteOrganisaties.map(org => ({
            id: org.id,
            naam: org.naam,
            aantalChatbots: org.chatbots.length,
            aantalGesprekken: org.chatbots.reduce((sum, bot) => sum + bot.gesprekken.length, 0)
          })).sort((a, b) => b.aantalGesprekken - a.aantalGesprekken).slice(0, 5),
          populairsteChatbots: populairsteChatbots.map(bot => ({
            id: bot.id,
            naam: bot.botNaam,
            organisatie: bot.organisatie.naam,
            aantalGesprekken: bot.gesprekken.length,
            tevredenheid: 0 // TODO: Bereken tevredenheid
          })).sort((a, b) => b.aantalGesprekken - a.aantalGesprekken).slice(0, 10)
        }
      };

      return {
        success: true,
        data: statistieken
      };

    } catch (error: any) {
      logger.error({ err: error, gebruikerId }, 'Fout bij ophalen dashboard statistieken');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het ophalen van dashboard statistieken',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Haal organisatie statistieken op
   */
  async getOrganisatieStatistieken(
    organisatieId: string, 
    gebruikerId: string,
    van?: Date,
    tot?: Date
  ): Promise<ServiceResult<OrganisatieStatistieken>> {
    try {
      // Controleer toegang
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          organisatieId,
          gebruikerId,
          isActief: true
        }
      });

      if (!lidmaatschap) {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Geen toegang tot deze organisatie',
            code: ERROR_CODES.FORBIDDEN,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      const nu = new Date();
      const vanDatum = van || new Date(nu.getTime() - 30 * 24 * 60 * 60 * 1000);
      const totDatum = tot || nu;

      // Chatbot statistieken
      const chatbots = await this.prisma.chatBot.findMany({
        where: { organisatieId },
        include: {
          gesprekken: {
            where: {
              startTijd: {
                gte: vanDatum,
                lte: totDatum
              }
            }
          }
        }
      });

      const totaalGesprekken = await this.prisma.gesprek.count({
        where: {
          chatbot: { organisatieId },
          startTijd: {
            gte: vanDatum,
            lte: totDatum
          }
        }
      });

      const totaalBerichten = await this.prisma.bericht.count({
        where: {
          gesprek: {
            chatbot: { organisatieId }
          },
          aangemaaktOp: {
            gte: vanDatum,
            lte: totDatum
          }
        }
      });

      const statistieken: OrganisatieStatistieken = {
        organisatieId,
        periode: {
          van: vanDatum,
          tot: totDatum
        },
        chatbots: {
          totaal: chatbots.length,
          actief: chatbots.filter(c => c.status === 'ACTIEF').length,
          inactief: chatbots.filter(c => c.status === 'INACTIEF').length,
          populairste: chatbots.map(bot => ({
            id: bot.id,
            naam: bot.botNaam,
            aantalGesprekken: bot.gesprekken.length,
            gemiddeldeTevredenheid: 0 // TODO: Bereken
          })).sort((a, b) => b.aantalGesprekken - a.aantalGesprekken).slice(0, 5)
        },
        gesprekken: {
          totaal: totaalGesprekken,
          afgerond: 0, // TODO
          actief: 0,   // TODO
          onderbroken: 0, // TODO
          volumePerDag: [], // TODO
          gemiddeldeDuur: 0 // TODO
        },
        berichten: {
          totaal: totaalBerichten,
          vanGebruikers: 0, // TODO
          vanChatbot: 0,    // TODO
          gemiddeldeResponsTijd: 0 // TODO
        },
        tevredenheid: {
          gemiddelde: 0, // TODO
          verdeling: []  // TODO
        },
        gebruikspatronen: {
          drukstePeriodes: [], // TODO
          populairsteVragen: [] // TODO
        }
      };

      return {
        success: true,
        data: statistieken
      };

    } catch (error: any) {
      logger.error({ err: error, organisatieId, gebruikerId }, 'Fout bij ophalen organisatie statistieken');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het ophalen van organisatie statistieken',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Helper functie om data per dag te groeperen
   */
  private groupByDay(data: any[], dateField: string): Array<{ datum: Date; aantal: number }> {
    const grouped = data.reduce((acc, item) => {
      const datum = new Date(item[dateField]).toDateString();
      acc[datum] = (acc[datum] || 0) + (item._count || 1);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([datum, aantal]) => ({
      datum: new Date(datum),
      aantal: aantal as number
    }));
  }
}
