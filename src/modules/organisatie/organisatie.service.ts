import { PrismaClient } from '@prisma/client';
import { generateSlug, generateUniqueSlug } from '../../shared/utils/crypto.js';
import { addTimeToDate } from '../../shared/utils/helpers.js';
import { logAudit, createLogger } from '../../shared/utils/logger.js';
import { ERROR_CODES } from '../../config/constants.js';
import type {
  MaakOrganisatie,
  UpdateOrganisatie,
  OrganisatieResponse,
  OrganisatieDetailResponse,
  OrganisatieStatistieken,
  OrganisatieLid,
  WijzigLidRol,
  OrganisatieGebruiksStatistieken
} from './organisatie.dto.js';
import type { ServiceResult, CustomError } from '../../shared/types/index.js';

const logger = createLogger('OrganisatieService');

export class OrganisatieService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Maak nieuwe organisatie aan
   */
  async maakOrganisatie(
    data: MaakOrganisatie,
    eigenaarId: string
  ): Promise<ServiceResult<OrganisatieResponse>> {
    try {
      // Check of eigenaar al een organisatie heeft (indien single-org per user)
      // Voor nu toestaan we meerdere organisaties per gebruiker

      // Genereer slug
      let slug = data.slug || generateSlug(data.naam);
      
      // Check of slug al bestaat
      const bestaandeSlugs = await this.prisma.organisatie.findMany({
        select: { slug: true }
      });
      
      slug = generateUniqueSlug(slug, bestaandeSlugs.map(o => o.slug));

      // Check of domein al in gebruik is
      if (data.domein) {
        const bestaandDomein = await this.prisma.organisatie.findUnique({
          where: { domein: data.domein }
        });
        
        if (bestaandDomein) {
          return {
            success: false,
            error: {
              name: 'ValidationError',
              message: 'Dit domein is al in gebruik door een andere organisatie',
              statusCode: 400,
              code: ERROR_CODES.RESOURCE_ALREADY_EXISTS,
            } as CustomError
          };
        }
      }

      const organisatie = await this.prisma.$transaction(async (tx) => {
        // Maak organisatie aan
        const nieuweOrganisatie = await tx.organisatie.create({
          data: {
            naam: data.naam,
            slug,
            domein: data.domein || null,
            eigenaarId,
            proefperiodeEindigtOp: addTimeToDate(new Date(), 30, 'days'), // 30 dagen proefperiode
          },
          include: {
            eigenaar: {
              select: {
                id: true,
                voornaam: true,
                tussenvoegsel: true,
                achternaam: true,
                email: true,
              }
            }
          }
        });

        // Maak lidmaatschap voor eigenaar
        await tx.organisatieLidmaatschap.create({
          data: {
            gebruikerId: eigenaarId,
            organisatieId: nieuweOrganisatie.id,
            rol: 'EIGENAAR',
          }
        });

        // Maak basis rechten aan
        const basisRechten = [
          {
            naam: 'ORGANISATIE_BEKIJKEN',
            beschrijving: 'Organisatie informatie bekijken',
            categorie: 'ORGANISATIE',
          },
          {
            naam: 'ORGANISATIE_BEWERKEN',
            beschrijving: 'Organisatie informatie bewerken',
            categorie: 'ORGANISATIE',
          },
          {
            naam: 'LEDEN_BEKIJKEN',
            beschrijving: 'Organisatie leden bekijken',
            categorie: 'LEDEN',
          },
          {
            naam: 'LEDEN_BEHEREN',
            beschrijving: 'Organisatie leden beheren',
            categorie: 'LEDEN',
          },
          {
            naam: 'UITNODIGINGEN_VERSTUREN',
            beschrijving: 'Uitnodigingen versturen',
            categorie: 'LEDEN',
          },
          {
            naam: 'CHATBOT_AANMAKEN',
            beschrijving: 'ChatBot aanmaken',
            categorie: 'CHATBOT',
          },
          {
            naam: 'CHATBOT_BEWERKEN',
            beschrijving: 'ChatBot bewerken',
            categorie: 'CHATBOT',
          },
          {
            naam: 'CHATBOT_VERWIJDEREN',
            beschrijving: 'ChatBot verwijderen',
            categorie: 'CHATBOT',
          },
        ];

        for (const recht of basisRechten) {
          await tx.recht.create({
            data: {
              ...recht,
              organisatieId: nieuweOrganisatie.id,
            }
          });
        }

        return nieuweOrganisatie;
      });

      // Log activiteit
      logAudit('ORGANISATIE_AANGEMAAKT', eigenaarId, organisatie.id, { 
        organisatieNaam: organisatie.naam,
        slug: organisatie.slug 
      });

      logger.info({ 
        organisatieId: organisatie.id,
        eigenaarId,
        naam: organisatie.naam 
      }, 'Nieuwe organisatie aangemaakt');

      return {
        success: true,
        data: this.formatOrganisatieResponse(organisatie)
      };

    } catch (error) {
      logger.error({ err: error, eigenaarId }, 'Fout bij aanmaken organisatie');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het aanmaken van de organisatie',
          statusCode: 500,
        } as CustomError
      };
    }
  }

  /**
   * Haal organisatie op via ID
   */
  async getOrganisatieById(
    id: string,
    gebruikerId?: string
  ): Promise<ServiceResult<OrganisatieDetailResponse>> {
    try {
      const organisatie = await this.prisma.organisatie.findUnique({
        where: { id },
        include: {
          eigenaar: {
            select: {
              id: true,
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true,
              email: true,
            }
          },
          leden: {
            select: { id: true },
            where: { isActief: true }
          },
          chatbots: {
            select: { id: true }
          }
        }
      });

      if (!organisatie) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Organisatie niet gevonden',
            statusCode: 404,
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
          } as CustomError
        };
      }

      // Check of gebruiker lid is van organisatie (indien opgegeven)
      if (gebruikerId) {
        const lidmaatschap = await this.prisma.organisatieLidmaatschap.findUnique({
          where: {
            gebruikerId_organisatieId: {
              gebruikerId,
              organisatieId: id
            },
            isActief: true
          }
        });

        if (!lidmaatschap) {
          return {
            success: false,
            error: {
              name: 'ForbiddenError',
              message: 'Geen toegang tot deze organisatie',
              statusCode: 403,
              code: ERROR_CODES.USER_NOT_MEMBER,
            } as CustomError
          };
        }
      }

      const response: OrganisatieDetailResponse = {
        ...this.formatOrganisatieResponse(organisatie),
        ipWhitelist: organisatie.ipWhitelist,
        maxOpslag: organisatie.maxOpslag,
        maxApiCalls: organisatie.maxApiCalls,
        maxProjecten: organisatie.maxProjecten,
        dataIsolatieId: organisatie.dataIsolatieId,
        aantalLeden: organisatie.leden.length,
        aantalChatbots: organisatie.chatbots.length,
      };

      return {
        success: true,
        data: response
      };

    } catch (error) {
      logger.error({ err: error, organisatieId: id }, 'Fout bij ophalen organisatie');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het ophalen van de organisatie',
          statusCode: 500,
        } as CustomError
      };
    }
  }

  /**
   * Update organisatie
   */
  async updateOrganisatie(
    id: string,
    data: UpdateOrganisatie,
    gebruikerId: string
  ): Promise<ServiceResult<OrganisatieResponse>> {
    try {
      // Check permissies
      const heeftRecht = await this.checkPermission(id, gebruikerId, 'ORGANISATIE_BEWERKEN');
      if (!heeftRecht.success) {
        return {
          success: false,
          error: heeftRecht.error
        };
      }

      // Check domein conflict
      if (data.domein) {
        const bestaandDomein = await this.prisma.organisatie.findFirst({
          where: {
            domein: data.domein,
            id: { not: id }
          }
        });
        
        if (bestaandDomein) {
          return {
            success: false,
            error: {
              name: 'ValidationError',
              message: 'Dit domein is al in gebruik door een andere organisatie',
              statusCode: 400,
              code: ERROR_CODES.RESOURCE_ALREADY_EXISTS,
            } as CustomError
          };
        }
      }

      const organisatie = await this.prisma.organisatie.update({
        where: { id },
        data: {
          naam: data.naam,
          domein: data.domein,
          tweeFAVerplicht: data.tweeFAVerplicht,
          maxAantalLeden: data.maxAantalLeden,
          sessieTimeoutMinuten: data.sessieTimeoutMinuten,
          ipWhitelist: data.ipWhitelist || [],
        },
        include: {
          eigenaar: {
            select: {
              id: true,
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true,
              email: true,
            }
          }
        }
      });

      logAudit('ORGANISATIE_BIJGEWERKT', gebruikerId, id);

      return {
        success: true,
        data: this.formatOrganisatieResponse(organisatie)
      };

    } catch (error) {
      logger.error({ err: error, organisatieId: id, gebruikerId }, 'Fout bij updaten organisatie');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het bijwerken van de organisatie',
          statusCode: 500,
        } as CustomError
      };
    }
  }

  /**
   * Haal organisatie leden op
   */
  async getOrganisatieLeden(
    organisatieId: string,
    gebruikerId: string
  ): Promise<ServiceResult<OrganisatieLid[]>> {
    try {
      // Check permissies
      const heeftRecht = await this.checkPermission(organisatieId, gebruikerId, 'LEDEN_BEKIJKEN');
      if (!heeftRecht.success) {
        return {
          success: false,
          error: heeftRecht.error
        };
      }

      const leden = await this.prisma.organisatieLidmaatschap.findMany({
        where: {
          organisatieId,
          isActief: true,
        },
        include: {
          gebruiker: {
            select: {
              id: true,
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true,
              email: true,
              laatsteLogin: true,
            }
          }
        },
        orderBy: {
          aangemaaktOp: 'desc'
        }
      });

      const response: OrganisatieLid[] = leden.map(lid => ({
        id: lid.id,
        gebruiker: lid.gebruiker,
        rol: lid.rol as 'EIGENAAR' | 'BEHEERDER' | 'MANAGER' | 'LID',
        aangemaaktOp: lid.aangemaaktOp,
        isActief: lid.isActief,
        laatsteActiviteit: lid.laatsteActiviteit,
      }));

      return {
        success: true,
        data: response
      };

    } catch (error) {
      logger.error({ err: error, organisatieId, gebruikerId }, 'Fout bij ophalen leden');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het ophalen van leden',
          statusCode: 500,
        } as CustomError
      };
    }
  }

  /**
   * Wijzig rol van lid
   */
  async wijzigLidRol(
    organisatieId: string,
    lidmaatschapId: string,
    data: WijzigLidRol,
    gebruikerId: string
  ): Promise<ServiceResult<OrganisatieLid>> {
    try {
      // Check permissies
      const heeftRecht = await this.checkPermission(organisatieId, gebruikerId, 'LEDEN_BEHEREN');
      if (!heeftRecht.success) {
        return {
          success: false,
          error: heeftRecht.error
        };
      }

      // Check of lidmaatschap bestaat en van deze organisatie is
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          id: lidmaatschapId,
          organisatieId,
          isActief: true,
        },
        include: {
          gebruiker: {
            select: {
              id: true,
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true,
              email: true,
              laatsteLogin: true,
            }
          }
        }
      });

      if (!lidmaatschap) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Lidmaatschap niet gevonden',
            statusCode: 404,
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
          } as CustomError
        };
      }

      // Check of het niet de eigenaar is
      if (lidmaatschap.rol === 'EIGENAAR') {
        return {
          success: false,
          error: {
            name: 'ValidationError',
            message: 'De rol van eigenaar kan niet worden gewijzigd',
            statusCode: 400,
            code: ERROR_CODES.INVALID_INPUT,
          } as CustomError
        };
      }

      // Update rol
      const updatedLidmaatschap = await this.prisma.organisatieLidmaatschap.update({
        where: { id: lidmaatschapId },
        data: { rol: data.rol },
        include: {
          gebruiker: {
            select: {
              id: true,
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true,
              email: true,
              laatsteLogin: true,
            }
          }
        }
      });

      logAudit('LID_ROL_GEWIJZIGD', gebruikerId, organisatieId, {
        doelGebruikerId: lidmaatschap.gebruikerId,
        oudeRol: lidmaatschap.rol,
        nieuweRol: data.rol
      });

      const response: OrganisatieLid = {
        id: updatedLidmaatschap.id,
        gebruiker: updatedLidmaatschap.gebruiker,
        rol: updatedLidmaatschap.rol as 'EIGENAAR' | 'BEHEERDER' | 'MANAGER' | 'LID',
        aangemaaktOp: updatedLidmaatschap.aangemaaktOp,
        isActief: updatedLidmaatschap.isActief,
        laatsteActiviteit: updatedLidmaatschap.laatsteActiviteit,
      };

      return {
        success: true,
        data: response
      };

    } catch (error) {
      logger.error({ err: error, organisatieId, lidmaatschapId }, 'Fout bij wijzigen rol');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het wijzigen van de rol',
          statusCode: 500,
        } as CustomError
      };
    }
  }

  /**
   * Verwijder lid uit organisatie
   */
  async verwijderLid(
    organisatieId: string,
    lidmaatschapId: string,
    gebruikerId: string
  ): Promise<ServiceResult<{ message: string }>> {
    try {
      // Check permissies
      const heeftRecht = await this.checkPermission(organisatieId, gebruikerId, 'LEDEN_BEHEREN');
      if (!heeftRecht.success) {
        return {
          success: false,
          error: heeftRecht.error
        };
      }

      // Check lidmaatschap
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findFirst({
        where: {
          id: lidmaatschapId,
          organisatieId,
          isActief: true,
        }
      });

      if (!lidmaatschap) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Lidmaatschap niet gevonden',
            statusCode: 404,
          } as CustomError
        };
      }

      // Check of het niet de eigenaar is
      if (lidmaatschap.rol === 'EIGENAAR') {
        return {
          success: false,
          error: {
            name: 'ValidationError',
            message: 'De eigenaar kan niet worden verwijderd',
            statusCode: 400,
            code: ERROR_CODES.OWNER_CANNOT_LEAVE,
          } as CustomError
        };
      }

      // Deactiveer lidmaatschap
      await this.prisma.organisatieLidmaatschap.update({
        where: { id: lidmaatschapId },
        data: { isActief: false }
      });

      logAudit('LID_VERWIJDERD', gebruikerId, organisatieId, {
        verwijderdGebruikerId: lidmaatschap.gebruikerId
      });

      return {
        success: true,
        data: { message: 'Lid succesvol verwijderd uit organisatie' }
      };

    } catch (error) {
      logger.error({ err: error, organisatieId, lidmaatschapId }, 'Fout bij verwijderen lid');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het verwijderen van het lid',
          statusCode: 500,
        } as CustomError
      };
    }
  }

  /**
   * Helper methods
   */
  private formatOrganisatieResponse(organisatie: any): OrganisatieResponse {
    return {
      id: organisatie.id,
      naam: organisatie.naam,
      slug: organisatie.slug,
      domein: organisatie.domein,
      aangemaaktOp: organisatie.aangemaaktOp,
      bijgewerktOp: organisatie.bijgewerktOp,
      tweeFAVerplicht: organisatie.tweeFAVerplicht,
      maxAantalLeden: organisatie.maxAantalLeden,
      sessieTimeoutMinuten: organisatie.sessieTimeoutMinuten,
      eigenaar: organisatie.eigenaar,
      abonnementStatus: organisatie.abonnementStatus,
      proefperiodeEindigtOp: organisatie.proefperiodeEindigtOp,
    };
  }

  private async checkPermission(
    organisatieId: string,
    gebruikerId: string,
    permission: string
  ): Promise<ServiceResult<boolean>> {
    try {
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findUnique({
        where: {
          gebruikerId_organisatieId: {
            gebruikerId,
            organisatieId
          },
          isActief: true
        },
        include: {
          rechten: {
            include: {
              recht: true
            },
            where: {
              toegekend: true
            }
          }
        }
      });

      if (!lidmaatschap) {
        return {
          success: false,
          error: {
            name: 'ForbiddenError',
            message: 'Geen toegang tot deze organisatie',
            statusCode: 403,
            code: ERROR_CODES.USER_NOT_MEMBER,
          } as CustomError
        };
      }

      // EIGENAAR heeft altijd alle rechten
      if (lidmaatschap.rol === 'EIGENAAR') {
        return { success: true, data: true };
      }

      // Check specifieke rechten
      const heeftRecht = lidmaatschap.rechten.some(r => r.recht.naam === permission);
      
      if (!heeftRecht) {
        return {
          success: false,
          error: {
            name: 'ForbiddenError',
            message: `Onvoldoende rechten. ${permission} vereist.`,
            statusCode: 403,
            code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          } as CustomError
        };
      }

      return { success: true, data: true };

    } catch (error) {
      logger.error({ err: error, organisatieId, gebruikerId, permission }, 'Fout bij permissie check');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij de autorisatie check',
          statusCode: 500,
        } as CustomError
      };
    }
  }
}
