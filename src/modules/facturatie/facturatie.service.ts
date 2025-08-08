import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import type { ServiceResult } from '../../shared/types/index.js';

const logger = createLogger('FacturatieService');

export enum AbonnementPlan {
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE'
}

export enum AbonnementStatus {
  ACTIEF = 'ACTIEF',
  VERLOPEN = 'VERLOPEN',
  GEANNULEERD = 'GEANNULEERD',
  OPGESCHORT = 'OPGESCHORT'
}

export interface AbonnementDetail {
  id: string;
  organisatieId: string;
  plan: AbonnementPlan;
  status: AbonnementStatus;
  startDatum: Date;
  eindDatum?: Date;
  prijs: number;
  limietChatbots: number;
  limietBerichten: number;
  limietOpslag: number;
  features: string[];
}

export class FacturatieService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Haal abonnement van organisatie op
   */
  async getAbonnement(organisatieId: string, gebruikerId: string): Promise<ServiceResult<AbonnementDetail>> {
    try {
      // Controleer rechten
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          organisatieId,
          gebruikerId,
          isActief: true
        }
      });

      if (!lidmaatschap || !['EIGENAAR', 'BEHEERDER'].includes(lidmaatschap.rol)) {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Geen toegang tot facturatiegegevens',
            code: ERROR_CODES.FORBIDDEN,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      const abonnement = await this.prisma.abonnement.findUnique({
        where: { organisatieId },
        include: {
          facturen: {
            orderBy: { aangemaaktOp: 'desc' },
            take: 5
          }
        }
      });

      if (!abonnement) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Geen abonnement gevonden',
            code: ERROR_CODES.NOT_FOUND,
            statusCode: HTTP_STATUS.NOT_FOUND
          }
        };
      }

      const planDetails = this.getPlanDetails(abonnement.plan as AbonnementPlan);

      return {
        success: true,
        data: {
          id: abonnement.id,
          organisatieId: abonnement.organisatieId,
          plan: abonnement.plan as AbonnementPlan,
          status: abonnement.status as AbonnementStatus,
          startDatum: abonnement.startDatum,
          eindDatum: abonnement.eindDatum,
          prijs: planDetails.prijs,
          limietChatbots: planDetails.limietChatbots,
          limietBerichten: planDetails.limietBerichten,
          limietOpslag: planDetails.limietOpslag,
          features: planDetails.features
        }
      };

    } catch (error: any) {
      logger.error({ err: error, organisatieId, gebruikerId }, 'Fout bij ophalen abonnement');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Upgrade/downgrade abonnement
   */
  async wijzigAbonnement(organisatieId: string, nieuwPlan: AbonnementPlan, gebruikerId: string): Promise<ServiceResult<AbonnementDetail>> {
    try {
      // Controleer rechten (alleen eigenaar kan abonnement wijzigen)
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          organisatieId,
          gebruikerId,
          isActief: true
        }
      });

      if (!lidmaatschap || lidmaatschap.rol !== 'EIGENAAR') {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Alleen eigenaren kunnen het abonnement wijzigen',
            code: ERROR_CODES.FORBIDDEN,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      const planDetails = this.getPlanDetails(nieuwPlan);
      const nu = new Date();

      const abonnement = await this.prisma.abonnement.upsert({
        where: { organisatieId },
        update: {
          plan: nieuwPlan,
          status: 'ACTIEF',
          bijgewerktOp: nu
        },
        create: {
          organisatieId,
          plan: nieuwPlan,
          status: 'ACTIEF',
          startDatum: nu
        }
      });

      logger.info({
        organisatieId,
        gebruikerId,
        nieuwPlan,
        vorigPlan: abonnement.plan
      }, 'Abonnement gewijzigd');

      return {
        success: true,
        data: {
          id: abonnement.id,
          organisatieId,
          plan: nieuwPlan,
          status: abonnement.status as AbonnementStatus,
          startDatum: abonnement.startDatum,
          eindDatum: abonnement.eindDatum,
          prijs: planDetails.prijs,
          limietChatbots: planDetails.limietChatbots,
          limietBerichten: planDetails.limietBerichten,
          limietOpslag: planDetails.limietOpslag,
          features: planDetails.features
        }
      };

    } catch (error: any) {
      logger.error({ err: error, organisatieId, nieuwPlan }, 'Fout bij wijzigen abonnement');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het wijzigen van het abonnement',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Controleer abonnement limieten
   */
  async controleerLimieten(organisatieId: string, type: 'chatbots' | 'berichten' | 'opslag'): Promise<ServiceResult<{ bereiktLimiet: boolean; huidigGebruik: number; limiet: number }>> {
    try {
      const abonnement = await this.prisma.abonnement.findUnique({
        where: { organisatieId }
      });

      if (!abonnement) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Geen abonnement gevonden',
            code: ERROR_CODES.NOT_FOUND,
            statusCode: HTTP_STATUS.NOT_FOUND
          }
        };
      }

      const planDetails = this.getPlanDetails(abonnement.plan as AbonnementPlan);
      let huidigGebruik = 0;
      let limiet = 0;

      switch (type) {
        case 'chatbots':
          huidigGebruik = await this.prisma.chatBot.count({
            where: { organisatieId }
          });
          limiet = planDetails.limietChatbots;
          break;
        case 'berichten':
          huidigGebruik = await this.prisma.bericht.count({
            where: { 
              gesprek: { 
                chatbot: { organisatieId } 
              },
              aangemaaktOp: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
              }
            }
          });
          limiet = planDetails.limietBerichten;
          break;
        case 'opslag':
          // TODO: Implementeer opslag berekening
          limiet = planDetails.limietOpslag;
          break;
      }

      return {
        success: true,
        data: {
          bereiktLimiet: huidigGebruik >= limiet,
          huidigGebruik,
          limiet
        }
      };

    } catch (error: any) {
      logger.error({ err: error, organisatieId, type }, 'Fout bij controleren limieten');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Plan details
   */
  private getPlanDetails(plan: AbonnementPlan) {
    switch (plan) {
      case AbonnementPlan.STARTER:
        return {
          prijs: 29,
          limietChatbots: 3,
          limietBerichten: 1000,
          limietOpslag: 1000, // MB
          features: ['Basis chatbot', 'E-mail ondersteuning']
        };
      case AbonnementPlan.PROFESSIONAL:
        return {
          prijs: 99,
          limietChatbots: 10,
          limietBerichten: 10000,
          limietOpslag: 5000,
          features: ['Geavanceerde chatbot', 'Analytics', 'Priority support', 'API toegang']
        };
      case AbonnementPlan.ENTERPRISE:
        return {
          prijs: 299,
          limietChatbots: -1, // Unlimited
          limietBerichten: -1,
          limietOpslag: -1,
          features: ['Custom chatbot', 'White-label', '24/7 support', 'Dedicated account manager']
        };
      default:
        return {
          prijs: 0,
          limietChatbots: 1,
          limietBerichten: 100,
          limietOpslag: 100,
          features: []
        };
    }
  }
}
