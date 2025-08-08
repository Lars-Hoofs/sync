import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import type { ServiceResult } from '../../shared/types/index.js';

const logger = createLogger('GroepService');

export interface MaakGroep {
  naam: string;
  beschrijving?: string;
  organisatieId: string;
  rechten?: string[];
}

export interface UpdateGroep {
  naam?: string;
  beschrijving?: string;
  rechten?: string[];
}

export class GroepService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Maak nieuwe groep aan
   */
  async maakGroep(data: MaakGroep, gebruikerId: string): Promise<ServiceResult<any>> {
    try {
      // Controleer organisatie rechten
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          organisatieId: data.organisatieId,
          gebruikerId,
          isActief: true
        }
      });

      if (!lidmaatschap || !['EIGENAAR', 'BEHEERDER'].includes(lidmaatschap.rol)) {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Onvoldoende rechten om groepen aan te maken',
            code: ERROR_CODES.FORBIDDEN,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      const groep = await this.prisma.groep.create({
        data: {
          naam: data.naam,
          beschrijving: data.beschrijving,
          organisatieId: data.organisatieId,
          aangemaaktDoor: gebruikerId
        }
      });

      // Voeg rechten toe indien opgegeven
      if (data.rechten && data.rechten.length > 0) {
        await this.prisma.groepRecht.createMany({
          data: data.rechten.map(recht => ({
            groepId: groep.id,
            recht
          }))
        });
      }

      logger.info({
        groepId: groep.id,
        organisatieId: data.organisatieId,
        gebruikerId
      }, 'Groep aangemaakt');

      return {
        success: true,
        data: groep
      };

    } catch (error: any) {
      logger.error({ err: error, data, gebruikerId }, 'Fout bij aanmaken groep');
      
        return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het aanmaken van de groep',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Voeg gebruiker toe aan groep
   */
  async voegGebruikerToeAanGroep(groepId: string, gebruikerId: string, toegevoegdDoor: string): Promise<ServiceResult<any>> {
    try {
      const groep = await this.prisma.groep.findUnique({
        where: { id: groepId },
        include: { organisatie: true }
      });

      if (!groep) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Groep niet gevonden',
            code: ERROR_CODES.NOT_FOUND,
            statusCode: HTTP_STATUS.NOT_FOUND
          }
        };
      }

      // Controleer rechten
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          organisatieId: groep.organisatieId,
          gebruikerId: toegevoegdDoor,
          isActief: true
        }
      });

      if (!lidmaatschap || !['EIGENAAR', 'BEHEERDER'].includes(lidmaatschap.rol)) {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Onvoldoende rechten',
            code: ERROR_CODES.FORBIDDEN,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      // Controleer of gebruiker al in groep zit
      const bestaandLidmaatschap = await this.prisma.groepLidmaatschap.findFirst({
        where: {
          groepId,
          gebruikerId,
          isActief: true
        }
      });

      if (bestaandLidmaatschap) {
        return {
          success: false,
          error: {
            name: 'ConflictError',
            message: 'Gebruiker is al lid van deze groep',
            code: ERROR_CODES.CONFLICT,
            statusCode: HTTP_STATUS.CONFLICT
          }
        };
      }

      const lidmaatschapGroep = await this.prisma.groepLidmaatschap.create({
        data: {
          groepId,
          gebruikerId,
          toegevoegdDoor,
          isActief: true
        }
      });

      return {
        success: true,
        data: lidmaatschapGroep
      };

    } catch (error: any) {
      logger.error({ err: error, groepId, gebruikerId }, 'Fout bij toevoegen gebruiker aan groep');
      
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
}
