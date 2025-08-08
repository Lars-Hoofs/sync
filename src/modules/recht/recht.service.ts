import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import type { ServiceResult } from '../../shared/types/index.js';

const logger = createLogger('RechtService');

// Basis rechten systeem
export const RECHTEN = {
  ORGANISATIE: {
    BEHEREN: 'organisatie:beheren',
    LEDEN_BEKIJKEN: 'organisatie:leden:bekijken',
    LEDEN_UITNODIGEN: 'organisatie:leden:uitnodigen',
    LEDEN_VERWIJDEREN: 'organisatie:leden:verwijderen'
  },
  CHATBOT: {
    AANMAKEN: 'chatbot:aanmaken',
    BEWERKEN: 'chatbot:bewerken',
    VERWIJDEREN: 'chatbot:verwijderen',
    BEKIJKEN: 'chatbot:bekijken',
    PUBLICEREN: 'chatbot:publiceren'
  },
  GESPREKKEN: {
    BEKIJKEN: 'gesprekken:bekijken',
    EXPORTEREN: 'gesprekken:exporteren',
    VERWIJDEREN: 'gesprekken:verwijderen'
  },
  ANALYTICS: {
    BEKIJKEN: 'analytics:bekijken',
    EXPORTEREN: 'analytics:exporteren'
  },
  FACTURATIE: {
    BEKIJKEN: 'facturatie:bekijken',
    BEHEREN: 'facturatie:beheren'
  }
} as const;

export type RechtType = typeof RECHTEN[keyof typeof RECHTEN][keyof typeof RECHTEN[keyof typeof RECHTEN]];

export class RechtService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Controleer of gebruiker een specifiek recht heeft in organisatie
   */
  async heeftRecht(gebruikerId: string, organisatieId: string, recht: string): Promise<ServiceResult<{ heeftRecht: boolean }>> {
    try {
      // Check direct lidmaatschap rol
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          gebruikerId,
          organisatieId,
          isActief: true
        }
      });

      if (!lidmaatschap) {
        return {
          success: true,
          data: { heeftRecht: false }
        };
      }

      // Eigenaar heeft alle rechten
      if (lidmaatschap.rol === 'EIGENAAR') {
        return {
          success: true,
          data: { heeftRecht: true }
        };
      }

      // Voor nu gebruiken we alleen basis rechten - groep functionaliteit kan later worden toegevoegd
      const heeftRecht = false;

      // Check basis rollen rechten
      const basisRechten = this.getBasisRechten(lidmaatschap.rol);
      const heeftBasisRecht = basisRechten.includes(recht);

      return {
        success: true,
        data: { heeftRecht: heeftRecht || heeftBasisRecht }
      };

    } catch (error: any) {
      logger.error({ err: error, gebruikerId, organisatieId, recht }, 'Fout bij controleren recht');
      
      return {
        success: false,
        error: {
          name: 'INTERNAL_ERROR',
          message: 'Er is een fout opgetreden bij het controleren van rechten',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Haal alle rechten van gebruiker op in organisatie
   */
  async getAlleRechten(gebruikerId: string, organisatieId: string): Promise<ServiceResult<{ rechten: string[] }>> {
    try {
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          gebruikerId,
          organisatieId,
          isActief: true
        }
      });

      if (!lidmaatschap) {
        return {
          success: true,
          data: { rechten: [] }
        };
      }

      let rechten: string[] = [];

      // Eigenaar heeft alle rechten
      if (lidmaatschap.rol === 'EIGENAAR') {
        rechten = Object.values(RECHTEN).flatMap(category => Object.values(category));
      } else {
        // Basis rechten per rol
        rechten = this.getBasisRechten(lidmaatschap.rol);

        // Voor nu gebruiken we alleen basis rechten - groep functionaliteit kan later worden toegevoegd
        // rechten blijft zoals het is vanuit de basis rechten
      }

      return {
        success: true,
        data: { rechten }
      };

    } catch (error: any) {
      logger.error({ err: error, gebruikerId, organisatieId }, 'Fout bij ophalen alle rechten');
      
      return {
        success: false,
        error: {
          name: 'INTERNAL_ERROR',
          message: 'Er is een fout opgetreden',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Haal rechten voor een specifieke rol op
   */
  async getRechtenVoorRol(rol: string): Promise<ServiceResult<{ rol: string; rechten: string[] }>> {
    try {
      const rechten = this.getBasisRechten(rol);
      
      return {
        success: true,
        data: {
          rol,
          rechten
        }
      };
    } catch (error: any) {
      logger.error({ err: error, rol }, 'Fout bij ophalen rechten voor rol');
      
      return {
        success: false,
        error: {
          name: 'INTERNAL_ERROR',
          message: 'Er is een fout opgetreden bij het ophalen van rechten voor rol',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Haal gebruiker rechten op (alias voor getAlleRechten)
   */
  async getGebruikerRechten(gebruikerId: string, organisatieId: string): Promise<ServiceResult<{ gebruikerId: string; organisatieId: string; rol: string; rechten: string[] }>> {
    try {
      // Haal lidmaatschap op voor rol informatie
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          gebruikerId,
          organisatieId,
          isActief: true
        }
      });

      if (!lidmaatschap) {
        return {
          success: true,
          data: {
            gebruikerId,
            organisatieId,
            rol: 'GEEN_LIDMAATSCHAP',
            rechten: []
          }
        };
      }

      const rechtenResult = await this.getAlleRechten(gebruikerId, organisatieId);
      
      if (!rechtenResult.success) {
        return rechtenResult as any;
      }

      return {
        success: true,
        data: {
          gebruikerId,
          organisatieId,
          rol: lidmaatschap.rol,
          rechten: rechtenResult.data.rechten
        }
      };
    } catch (error: any) {
      logger.error({ err: error, gebruikerId, organisatieId }, 'Fout bij ophalen gebruiker rechten');
      
      return {
        success: false,
        error: {
          name: 'INTERNAL_ERROR',
          message: 'Er is een fout opgetreden bij het ophalen van gebruiker rechten',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Basis rechten per rol
   */
  private getBasisRechten(rol: string): string[] {
    switch (rol) {
      case 'BEHEERDER':
        return [
          RECHTEN.ORGANISATIE.LEDEN_BEKIJKEN,
          RECHTEN.ORGANISATIE.LEDEN_UITNODIGEN,
          RECHTEN.CHATBOT.AANMAKEN,
          RECHTEN.CHATBOT.BEWERKEN,
          RECHTEN.CHATBOT.BEKIJKEN,
          RECHTEN.CHATBOT.PUBLICEREN,
          RECHTEN.GESPREKKEN.BEKIJKEN,
          RECHTEN.ANALYTICS.BEKIJKEN
        ];
      case 'EDITOR':
        return [
          RECHTEN.CHATBOT.BEWERKEN,
          RECHTEN.CHATBOT.BEKIJKEN,
          RECHTEN.GESPREKKEN.BEKIJKEN,
          RECHTEN.ANALYTICS.BEKIJKEN
        ];
      case 'VIEWER':
        return [
          RECHTEN.CHATBOT.BEKIJKEN,
          RECHTEN.GESPREKKEN.BEKIJKEN
        ];
      default:
        return [];
    }
  }
}
