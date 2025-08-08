import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import { generateSecureToken } from '../../shared/utils/tokens.js';
import type { ServiceResult } from '../../shared/types';
import type {
  MaakUitnodiging,
  BeantwoordUitnodiging,
  UpdateUitnodiging,
  UitnodigingDetail,
  UitnodigingOverzicht,
  MijnUitnodigingen,
  UitnodigingResponse
} from './uitnodiging.dto.js';
import { UitnodigingStatus } from './uitnodiging.types.js';
import type { OrganisatieRol } from '../../shared/types';

const logger = createLogger('UitnodigingService');

export class UitnodigingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Stuur nieuwe uitnodiging naar gebruiker
   */
  async stuurUitnodiging(data: MaakUitnodiging, uitnodigerId: string): Promise<ServiceResult<UitnodigingResponse>> {
    try {
      // Controleer of uitnodiger lid is van de organisatie en rechten heeft
      const uitnodigerLidmaatschap = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          organisatieId: data.organisatieId,
          gebruikerId: uitnodigerId,
          isActief: true
        }
      });

      if (!uitnodigerLidmaatschap) {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Je bent geen lid van deze organisatie',
            code: ERROR_CODES.FORBIDDEN,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      // Controleer rechten: alleen eigenaar en beheerder kunnen uitnodigen
      if (!['EIGENAAR', 'BEHEERDER'].includes(uitnodigerLidmaatschap.rol)) {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Je hebt geen rechten om uitnodigingen te versturen',
            code: ERROR_CODES.FORBIDDEN,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      // Controleer of er al een actieve uitnodiging bestaat voor dit e-mailadres
      const bestaandeUitnodiging = await this.prisma.uitnodiging.findFirst({
        where: {
          email: data.email,
          organisatieId: data.organisatieId,
          status: UitnodigingStatus.PENDING,
          verlooptOp: {
            gt: new Date()
          }
        }
      });

      if (bestaandeUitnodiging) {
        return {
          success: false,
          error: {
            name: 'ConflictError',
            message: 'Er is al een actieve uitnodiging verstuurd naar dit e-mailadres',
            code: ERROR_CODES.CONFLICT,
            statusCode: HTTP_STATUS.CONFLICT
          }
        };
      }

      // Controleer of gebruiker al lid is van de organisatie
      const bestaandGebruiker = await this.prisma.gebruiker.findUnique({
        where: { email: data.email }
      });

      if (bestaandGebruiker) {
        const bestaandLidmaatschap = await this.prisma.organisatieLidmaatschap.findFirst({
          where: {
            gebruikerId: bestaandGebruiker.id,
            organisatieId: data.organisatieId,
            isActief: true
          }
        });

        if (bestaandLidmaatschap) {
          return {
            success: false,
            error: {
              name: 'ConflictError',
              message: 'Deze gebruiker is al lid van de organisatie',
              code: ERROR_CODES.CONFLICT,
              statusCode: HTTP_STATUS.CONFLICT
            }
          };
        }
      }

      // Controleer rol rechten: alleen eigenaar kan andere eigenaren uitnodigen
      if (data.rol === 'EIGENAAR' && uitnodigerLidmaatschap.rol !== 'EIGENAAR') {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Alleen eigenaren kunnen andere eigenaren uitnodigen',
            code: ERROR_CODES.FORBIDDEN,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      // Genereer token en vervaldatum
      const token = generateSecureToken();
      const verlooptOp = new Date();
      verlooptOp.setDate(verlooptOp.getDate() + 7); // 7 dagen geldig

      // Maak uitnodiging aan
      const uitnodiging = await this.prisma.uitnodiging.create({
        data: {
          email: data.email,
          rol: data.rol,
          organisatieId: data.organisatieId,
          uitnodigerId,
          bericht: data.bericht,
          token,
          verlooptOp,
          status: UitnodigingStatus.PENDING
        },
        include: {
          organisatie: {
            select: {
              id: true,
              naam: true
            }
          },
          uitnodiger: {
            select: {
              id: true,
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true,
              email: true
            }
          }
        }
      });

      logger.info({
        uitnodigingId: uitnodiging.id,
        email: data.email,
        organisatieId: data.organisatieId,
        uitnodigerId
      }, 'Uitnodiging succesvol verstuurd');

      // TODO: Verstuur e-mail uitnodiging
      // await emailService.stuurUitnodigingsEmail(uitnodiging);

      return {
        success: true,
        data: {
          id: uitnodiging.id,
          email: uitnodiging.email,
          rol: uitnodiging.rol as OrganisatieRol,
          status: uitnodiging.status as UitnodigingStatus,
          organisatieId: uitnodiging.organisatieId,
          message: 'Uitnodiging succesvol verstuurd'
        }
      };

    } catch (error: any) {
      logger.error({ err: error, data, uitnodigerId }, 'Fout bij versturen uitnodiging');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het versturen van de uitnodiging',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Beantwoord uitnodiging (accepteren of afwijzen)
   */
  async beantwoordUitnodiging(token: string, data: BeantwoordUitnodiging, gebruikerId: string): Promise<ServiceResult<{ message: string }>> {
    try {
      // Zoek uitnodiging op basis van token
      const uitnodiging = await this.prisma.uitnodiging.findFirst({
        where: {
          token,
          status: UitnodigingStatus.PENDING,
          verlooptOp: {
            gt: new Date()
          }
        },
        include: {
          organisatie: {
            select: {
              naam: true
            }
          }
        }
      });

      if (!uitnodiging) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Ongeldige of verlopen uitnodiging',
            code: ERROR_CODES.NOT_FOUND,
            statusCode: HTTP_STATUS.NOT_FOUND
          }
        };
      }

      // Controleer of gebruiker hetzelfde e-mailadres heeft
      const gebruiker = await this.prisma.gebruiker.findUnique({
        where: { id: gebruikerId }
      });

      if (!gebruiker || gebruiker.email !== uitnodiging.email) {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Je kunt alleen uitnodigingen beantwoorden die naar jouw e-mailadres zijn gestuurd',
            code: ERROR_CODES.FORBIDDEN,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      if (data.accepteer) {
        // Accepteer uitnodiging
        await this.prisma.$transaction(async (tx) => {
          // Update uitnodiging status
          await tx.uitnodiging.update({
            where: { id: uitnodiging.id },
            data: {
              status: UitnodigingStatus.ACCEPTED,
              beantwoordOp: new Date()
            }
          });

          // Maak lidmaatschap aan
          await tx.organisatieLidmaatschap.create({
            data: {
              gebruikerId,
              organisatieId: uitnodiging.organisatieId,
              rol: uitnodiging.rol,
              isActief: true
            }
          });
        });

        logger.info({
          uitnodigingId: uitnodiging.id,
          gebruikerId,
          organisatieId: uitnodiging.organisatieId
        }, 'Uitnodiging geaccepteerd');

        return {
          success: true,
          data: {
            message: `Je bent succesvol toegevoegd aan ${uitnodiging.organisatie.naam}`
          }
        };

      } else {
        // Wijs uitnodiging af
        await this.prisma.uitnodiging.update({
          where: { id: uitnodiging.id },
          data: {
            status: UitnodigingStatus.DECLINED,
            beantwoordOp: new Date()
          }
        });

        logger.info({
          uitnodigingId: uitnodiging.id,
          gebruikerId
        }, 'Uitnodiging afgewezen');

        return {
          success: true,
          data: {
            message: 'Uitnodiging afgewezen'
          }
        };
      }

    } catch (error: any) {
      logger.error({ err: error, token, data, gebruikerId }, 'Fout bij beantwoorden uitnodiging');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het beantwoorden van de uitnodiging',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Haal uitnodiging informatie op voor publieke acceptance pagina
   */
  async getPubliekeUitnodiging(token: string): Promise<ServiceResult<any>> {
    try {
      const uitnodiging = await this.prisma.uitnodiging.findFirst({
        where: {
          token,
          status: 'PENDING'
        },
        include: {
          organisatie: {
            select: {
              naam: true
            }
          },
          uitnodiger: {
            select: {
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true
            }
          }
        }
      });

      if (!uitnodiging) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Ongeldige uitnodiging',
            code: ERROR_CODES.NOT_FOUND,
            statusCode: HTTP_STATUS.NOT_FOUND
          }
        };
      }

      const isVerlopen = uitnodiging.verlooptOp < new Date();
      
      // Update status naar expired als verlopen
      if (isVerlopen && uitnodiging.status === 'PENDING') {
        await this.prisma.uitnodiging.update({
          where: { id: uitnodiging.id },
          data: { status: 'EXPIRED' }
        });
      }

      // Controleer of gebruiker al bestaat
      const gebruikerBestaat = await this.prisma.gebruiker.findUnique({
        where: { email: uitnodiging.email }
      }) !== null;

      return {
        success: true,
        data: {
          organisatie: uitnodiging.organisatie,
          uitnodigingGeldig: !isVerlopen,
          gebruikerBestaat,
          rol: uitnodiging.rol,
          bericht: uitnodiging.bericht,
          verlooptOp: uitnodiging.verlooptOp,
          uitnodiger: uitnodiging.uitnodiger
        }
      };

    } catch (error: any) {
      logger.error({ err: error, token }, 'Fout bij ophalen publieke uitnodiging');
      
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
   * Haal uitnodigingen van een organisatie op
   */
  async getOrganisatieUitnodigingen(organisatieId: string, gebruikerId: string, filters: any = {}): Promise<ServiceResult<UitnodigingOverzicht[]>> {
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
            message: 'Je hebt geen rechten om uitnodigingen te bekijken',
            code: ERROR_CODES.FORBIDDEN,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      // Bouw where clausule
      const where: any = {
        organisatieId
      };

      if (filters.status) {
        where.status = filters.status;
      }

      const uitnodigingen = await this.prisma.uitnodiging.findMany({
        where,
        include: {
          organisatie: {
            select: {
              naam: true
            }
          },
          uitnodiger: {
            select: {
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true
            }
          }
        },
        orderBy: {
          aangemaaktOp: 'desc'
        },
        take: filters.limit || 20,
        skip: filters.offset || 0
      });

      const result: UitnodigingOverzicht[] = uitnodigingen.map(uitnodiging => ({
        id: uitnodiging.id,
        email: uitnodiging.email,
        rol: uitnodiging.rol as OrganisatieRol,
        status: uitnodiging.status as UitnodigingStatus,
        aangemaaktOp: uitnodiging.aangemaaktOp,
        verlooptOp: uitnodiging.verlooptOp,
        organisatie: uitnodiging.organisatie,
        uitnodiger: uitnodiging.uitnodiger
      }));

      return {
        success: true,
        data: result
      };

    } catch (error: any) {
      logger.error({ err: error, organisatieId, gebruikerId }, 'Fout bij ophalen organisatie uitnodigingen');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het ophalen van uitnodigingen',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Haal mijn openstaande uitnodigingen op
   */
  async getMijnUitnodigingen(gebruikerId: string): Promise<ServiceResult<MijnUitnodigingen[]>> {
    try {
      const gebruiker = await this.prisma.gebruiker.findUnique({
        where: { id: gebruikerId },
        select: { email: true }
      });

      if (!gebruiker) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Gebruiker niet gevonden',
            code: ERROR_CODES.NOT_FOUND,
            statusCode: HTTP_STATUS.NOT_FOUND
          }
        };
      }

      const uitnodigingen = await this.prisma.uitnodiging.findMany({
        where: {
          email: gebruiker.email,
          status: UitnodigingStatus.PENDING,
          verlooptOp: {
            gt: new Date()
          }
        },
        include: {
          organisatie: {
            select: {
              id: true,
              naam: true
            }
          },
          uitnodiger: {
            select: {
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true,
              email: true
            }
          }
        },
        orderBy: {
          aangemaaktOp: 'desc'
        }
      });

      const result: MijnUitnodigingen[] = uitnodigingen.map(uitnodiging => ({
        id: uitnodiging.id,
        rol: uitnodiging.rol as OrganisatieRol,
        status: uitnodiging.status as UitnodigingStatus,
        bericht: uitnodiging.bericht,
        aangemaaktOp: uitnodiging.aangemaaktOp,
        verlooptOp: uitnodiging.verlooptOp,
        organisatie: uitnodiging.organisatie,
        uitnodiger: uitnodiging.uitnodiger
      }));

      return {
        success: true,
        data: result
      };

    } catch (error: any) {
      logger.error({ err: error, gebruikerId }, 'Fout bij ophalen mijn uitnodigingen');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het ophalen van je uitnodigingen',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Intrek uitnodiging (cancel)
   */
  async intrekUitnodiging(uitnodigingId: string, gebruikerId: string): Promise<ServiceResult<{ message: string }>> {
    try {
      const uitnodiging = await this.prisma.uitnodiging.findUnique({
        where: { id: uitnodigingId },
        include: {
          organisatie: {
            select: { naam: true }
          }
        }
      });

      if (!uitnodiging) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Uitnodiging niet gevonden',
            code: ERROR_CODES.NOT_FOUND,
            statusCode: HTTP_STATUS.NOT_FOUND
          }
        };
      }

      // Controleer rechten
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          organisatieId: uitnodiging.organisatieId,
          gebruikerId,
          isActief: true
        }
      });

      if (!lidmaatschap || !['EIGENAAR', 'BEHEERDER'].includes(lidmaatschap.rol)) {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Je hebt geen rechten om deze uitnodiging in te trekken',
            code: ERROR_CODES.FORBIDDEN,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      if (uitnodiging.status !== UitnodigingStatus.PENDING) {
        return {
          success: false,
          error: {
            name: 'ValidationError',
            message: 'Alleen openstaande uitnodigingen kunnen worden ingetrokken',
            code: ERROR_CODES.BAD_REQUEST,
            statusCode: HTTP_STATUS.BAD_REQUEST
          }
        };
      }

      await this.prisma.uitnodiging.update({
        where: { id: uitnodigingId },
        data: {
          status: UitnodigingStatus.CANCELLED,
          bijgewerktOp: new Date()
        }
      });

      logger.info({
        uitnodigingId,
        gebruikerId,
        organisatieId: uitnodiging.organisatieId
      }, 'Uitnodiging ingetrokken');

      return {
        success: true,
        data: {
          message: 'Uitnodiging succesvol ingetrokken'
        }
      };

    } catch (error: any) {
      logger.error({ err: error, uitnodigingId, gebruikerId }, 'Fout bij intrekken uitnodiging');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het intrekken van de uitnodiging',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }
}
