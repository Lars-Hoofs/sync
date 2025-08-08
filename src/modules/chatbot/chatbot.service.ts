import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import { generateSecureToken } from '../../shared/utils/crypto.js';
import type { ServiceResult } from '../../shared/types/index.js';
import type {
  MaakChatbot,
  UpdateChatbot,
  ChatbotDetail,
  ChatbotOverzicht,
  ChatbotStatistieken,
  ChatbotResponse,
  MaakDatabron,
  UpdateDatabron,
  DatabronResponse,
  VoegTekstToe,
  TekstResponse
} from './chatbot.dto.js';
import type { DataBronType, ChatbotStatus } from './chatbot.types.js';

const logger = createLogger('ChatbotService');

export class ChatbotService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Maak nieuwe chatbot aan
   */
  async maakChatbot(data: MaakChatbot, gebruikerId: string): Promise<ServiceResult<ChatbotResponse>> {
    try {
      // Controleer of gebruiker lid is van organisatie
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findUnique({
        where: {
          gebruikerId_organisatieId: {
            gebruikerId,
            organisatieId: data.organisatieId
          },
          isActief: true
        }
      });

      if (!lidmaatschap || !['EIGENAAR', 'BEHEERDER', 'MANAGER'].includes(lidmaatschap.rol)) {
        return {
          success: false,
          error: {
            name: 'INSUFFICIENT_PERMISSIONS',
            message: 'Onvoldoende rechten om chatbots aan te maken',
            code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      // Genereer unieke API sleutel
      const apiSleutel = generateSecureToken(32);

      const chatbot = await this.prisma.chatBot.create({
        data: {
          organisatieId: data.organisatieId,
          botNaam: data.botNaam,
          widgetNaam: data.widgetNaam,
          websiteUrl: data.websiteUrl,
          klantenServiceEmail: data.klantenServiceEmail,
          basisPrompt: data.basisPrompt,
          toon: data.toon,
          startBericht: data.startBericht,
          mainKleur: data.styling.mainKleur,
          secundaireKleur: data.styling.secundaireKleur,
          achtergrondKleur: data.styling.achtergrondKleur,
          tekstKleur: data.styling.tekstKleur,
          knopKleur: data.styling.knopKleur,
          knopTekstKleur: data.styling.knopTekstKleur,
          knopHoverKleur: data.styling.knopHoverKleur,
          knopHoverTekstKleur: data.styling.knopHoverTekstKleur,
          fontGrootte: data.styling.fontGrootte,
          fontFamilie: data.styling.fontFamilie,
          status: 'CONCEPT',
          apiSleutel
        }
      });

      logger.info({
        chatbotId: chatbot.id,
        organisatieId: data.organisatieId,
        gebruikerId
      }, 'Chatbot aangemaakt');

      return {
        success: true,
        data: {
          id: chatbot.id,
          botNaam: chatbot.botNaam,
          widgetNaam: chatbot.widgetNaam,
          status: chatbot.status as ChatbotStatus,
          apiSleutel: chatbot.apiSleutel,
          aangemaaktOp: chatbot.aangemaaktOp,
          message: 'Chatbot succesvol aangemaakt'
        }
      };

    } catch (error: any) {
      logger.error({ err: error, data, gebruikerId }, 'Fout bij aanmaken chatbot');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het aanmaken van de chatbot',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Haal chatbot op
   */
  async getChatbotById(chatbotId: string, gebruikerId: string): Promise<ServiceResult<ChatbotDetail>> {
    try {
      const chatbot = await this.prisma.chatBot.findUnique({
        where: { id: chatbotId },
        include: {
          organisatie: {
            select: {
              id: true,
              naam: true,
              slug: true
            }
          },
          databronnen: {
            include: {
              teksten: {
                select: {
                  id: true,
                  onderwerp: true,
                  inhoud: true,
                  aangemaaktOp: true
                }
              }
            }
          },
          _count: {
            select: {
              databronnen: true
            }
          }
        }
      });

      if (!chatbot) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Chatbot niet gevonden',
            code: ERROR_CODES.NOT_FOUND,
            statusCode: HTTP_STATUS.NOT_FOUND
          }
        };
      }

      // Controleer toegang
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findUnique({
        where: {
          gebruikerId_organisatieId: {
            gebruikerId,
            organisatieId: chatbot.organisatieId
          },
          isActief: true
        }
      });

      if (!lidmaatschap) {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Geen toegang tot deze chatbot',
            code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      return {
        success: true,
        data: {
          id: chatbot.id,
          organisatieId: chatbot.organisatieId,
          botNaam: chatbot.botNaam,
          widgetNaam: chatbot.widgetNaam,
          websiteUrl: chatbot.websiteUrl,
          klantenServiceEmail: chatbot.klantenServiceEmail,
          basisPrompt: chatbot.basisPrompt,
          toon: chatbot.toon,
          startBericht: chatbot.startBericht,
          status: chatbot.status as ChatbotStatus,
          apiSleutel: chatbot.apiSleutel,
          styling: {
            mainKleur: chatbot.mainKleur,
            secundaireKleur: chatbot.secundaireKleur,
            achtergrondKleur: chatbot.achtergrondKleur,
            tekstKleur: chatbot.tekstKleur,
            knopKleur: chatbot.knopKleur,
            knopTekstKleur: chatbot.knopTekstKleur,
            knopHoverKleur: chatbot.knopHoverKleur,
            knopHoverTekstKleur: chatbot.knopHoverTekstKleur,
            fontGrootte: chatbot.fontGrootte,
            fontFamilie: chatbot.fontFamilie
          },
          organisatie: chatbot.organisatie,
          databronnen: chatbot.databronnen.map(bron => ({
            id: bron.id,
            type: bron.type as DataBronType,
            bestandsUrl: bron.bestandsUrl,
            websiteUrl: bron.websiteUrl,
            aantalTeksten: bron.teksten.length,
            aangemaaktOp: bron.aangemaaktOp || new Date(),
            bijgewerktOp: bron.bijgewerktOp || new Date()
          })),
          aantalDatabronnen: chatbot._count.databronnen,
          aangemaaktOp: chatbot.aangemaaktOp,
          bijgewerktOp: chatbot.bijgewerktOp
        }
      };

    } catch (error: any) {
      logger.error({ err: error, chatbotId, gebruikerId }, 'Fout bij ophalen chatbot');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het ophalen van de chatbot',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Update chatbot
   */
  async updateChatbot(chatbotId: string, data: UpdateChatbot, gebruikerId: string): Promise<ServiceResult<ChatbotResponse>> {
    try {
      const chatbot = await this.prisma.chatBot.findUnique({
        where: { id: chatbotId }
      });

      if (!chatbot) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Chatbot niet gevonden',
            code: ERROR_CODES.NOT_FOUND,
            statusCode: HTTP_STATUS.NOT_FOUND
          }
        };
      }

      // Controleer rechten
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findUnique({
        where: {
          gebruikerId_organisatieId: {
            gebruikerId,
            organisatieId: chatbot.organisatieId
          },
          isActief: true
        }
      });

      if (!lidmaatschap || !['EIGENAAR', 'BEHEERDER', 'MANAGER'].includes(lidmaatschap.rol)) {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Onvoldoende rechten om chatbot bij te werken',
            code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      const updateData: any = {
        bijgewerktOp: new Date()
      };

      // Update alleen de velden die zijn meegegeven
      if (data.botNaam !== undefined) updateData.botNaam = data.botNaam;
      if (data.widgetNaam !== undefined) updateData.widgetNaam = data.widgetNaam;
      if (data.websiteUrl !== undefined) updateData.websiteUrl = data.websiteUrl;
      if (data.klantenServiceEmail !== undefined) updateData.klantenServiceEmail = data.klantenServiceEmail;
      if (data.basisPrompt !== undefined) updateData.basisPrompt = data.basisPrompt;
      if (data.toon !== undefined) updateData.toon = data.toon;
      if (data.startBericht !== undefined) updateData.startBericht = data.startBericht;
      if (data.status !== undefined) updateData.status = data.status;

      // Update styling velden
      if (data.styling) {
        if (data.styling.mainKleur !== undefined) updateData.mainKleur = data.styling.mainKleur;
        if (data.styling.secundaireKleur !== undefined) updateData.secundaireKleur = data.styling.secundaireKleur;
        if (data.styling.achtergrondKleur !== undefined) updateData.achtergrondKleur = data.styling.achtergrondKleur;
        if (data.styling.tekstKleur !== undefined) updateData.tekstKleur = data.styling.tekstKleur;
        if (data.styling.knopKleur !== undefined) updateData.knopKleur = data.styling.knopKleur;
        if (data.styling.knopTekstKleur !== undefined) updateData.knopTekstKleur = data.styling.knopTekstKleur;
        if (data.styling.knopHoverKleur !== undefined) updateData.knopHoverKleur = data.styling.knopHoverKleur;
        if (data.styling.knopHoverTekstKleur !== undefined) updateData.knopHoverTekstKleur = data.styling.knopHoverTekstKleur;
        if (data.styling.fontGrootte !== undefined) updateData.fontGrootte = data.styling.fontGrootte;
        if (data.styling.fontFamilie !== undefined) updateData.fontFamilie = data.styling.fontFamilie;
      }

      const updatedChatbot = await this.prisma.chatBot.update({
        where: { id: chatbotId },
        data: updateData
      });

      logger.info({
        chatbotId,
        gebruikerId,
        updateData
      }, 'Chatbot bijgewerkt');

      return {
        success: true,
        data: {
          id: updatedChatbot.id,
          botNaam: updatedChatbot.botNaam,
          widgetNaam: updatedChatbot.widgetNaam,
          status: updatedChatbot.status as ChatbotStatus,
          apiSleutel: updatedChatbot.apiSleutel,
          aangemaaktOp: updatedChatbot.aangemaaktOp,
          message: 'Chatbot succesvol bijgewerkt'
        }
      };

    } catch (error: any) {
      logger.error({ err: error, chatbotId, data, gebruikerId }, 'Fout bij bijwerken chatbot');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het bijwerken van de chatbot',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Verwijder chatbot
   */
  async verwijderChatbot(chatbotId: string, gebruikerId: string): Promise<ServiceResult<{ message: string }>> {
    try {
      const chatbot = await this.prisma.chatBot.findUnique({
        where: { id: chatbotId }
      });

      if (!chatbot) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Chatbot niet gevonden',
            code: ERROR_CODES.NOT_FOUND,
            statusCode: HTTP_STATUS.NOT_FOUND
          }
        };
      }

      // Controleer rechten (alleen eigenaar en beheerder mogen verwijderen)
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findUnique({
        where: {
          gebruikerId_organisatieId: {
            gebruikerId,
            organisatieId: chatbot.organisatieId
          },
          isActief: true
        }
      });

      if (!lidmaatschap || !['EIGENAAR', 'BEHEERDER'].includes(lidmaatschap.rol)) {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Onvoldoende rechten om chatbot te verwijderen',
            code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      // Verwijder chatbot en gerelateerde data
      await this.prisma.$transaction([
        // Verwijder teksten
        this.prisma.chatbotTekst.deleteMany({
          where: {
            databron: {
              chatbotId
            }
          }
        }),
        // Verwijder databronnen
        this.prisma.chatbotDatabron.deleteMany({
          where: { chatbotId }
        }),
        // Verwijder chatbot zelf
        this.prisma.chatBot.delete({
          where: { id: chatbotId }
        })
      ]);

      logger.info({
        chatbotId,
        gebruikerId
      }, 'Chatbot verwijderd');

      return {
        success: true,
        data: {
          message: 'Chatbot succesvol verwijderd'
        }
      };

    } catch (error: any) {
      logger.error({ err: error, chatbotId, gebruikerId }, 'Fout bij verwijderen chatbot');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het verwijderen van de chatbot',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Haal chatbots van organisatie op
   */
  async getOrganisatieChatbots(organisatieId: string, gebruikerId: string): Promise<ServiceResult<ChatbotOverzicht[]>> {
    try {
      // Controleer toegang
      const lidmaatschap = await this.prisma.organisatieLidmaatschap.findUnique({
        where: {
          gebruikerId_organisatieId: {
            gebruikerId,
            organisatieId
          },
          isActief: true
        }
      });

      if (!lidmaatschap) {
        return {
          success: false,
          error: {
            name: 'PermissionError',
            message: 'Geen toegang tot deze organisatie',
            code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
            statusCode: HTTP_STATUS.FORBIDDEN
          }
        };
      }

      const chatbots = await this.prisma.chatBot.findMany({
        where: { organisatieId },
        include: {
          _count: {
            select: {
              databronnen: true
            }
          }
        },
        orderBy: {
          aangemaaktOp: 'desc'
        }
      });

      const chatbotOverzicht = chatbots.map(chatbot => ({
        id: chatbot.id,
        botNaam: chatbot.botNaam,
        widgetNaam: chatbot.widgetNaam,
        status: chatbot.status as ChatbotStatus,
        websiteUrl: chatbot.websiteUrl,
        aantalDatabronnen: chatbot._count.databronnen,
        aangemaaktOp: chatbot.aangemaaktOp,
        bijgewerktOp: chatbot.bijgewerktOp
      }));

      return {
        success: true,
        data: chatbotOverzicht
      };

    } catch (error: any) {
      logger.error({ err: error, organisatieId, gebruikerId }, 'Fout bij ophalen organisatie chatbots');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het ophalen van chatbots',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Wijzig chatbot status (placeholder)
   */
  async wijzigStatus(chatbotId: string, status: ChatbotStatus, gebruikerId: string): Promise<ServiceResult<{ message: string }>> {
    try {
      // Placeholder implementatie
      return {
        success: true,
        data: {
          message: `Status gewijzigd naar ${status} (placeholder)`
        }
      };
    } catch (error: any) {
        return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het wijzigen van de status',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Maak databron (placeholder)
   */
  async maakDatabron(chatbotId: string, data: MaakDatabron, gebruikerId: string): Promise<ServiceResult<DatabronResponse>> {
    try {
      // Placeholder implementatie
      return {
        success: true,
        data: {
          id: 'placeholder-databron-id',
          type: data.type || 'TEKST',
          bestandsUrl: data.bestandsUrl,
          websiteUrl: data.websiteUrl,
          chatbotId: data.chatbotId,
          aangemaaktOp: new Date(),
          bijgewerktOp: new Date(),
          teksten: []
        }
      };
    } catch (error: any) {
        return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het aanmaken van de databron',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Voeg tekst toe (placeholder)
   */
  async voegTekstToe(databronId: string, data: VoegTekstToe, gebruikerId: string): Promise<ServiceResult<TekstResponse>> {
    try {
      // Placeholder implementatie
      return {
        success: true,
        data: {
          id: 'placeholder-tekst-id',
          onderwerp: data.onderwerp,
          inhoud: data.inhoud,
          databronId: data.databronId,
          aangemaaktOp: new Date(),
          bijgewerktOp: new Date()
        }
      };
    } catch (error: any) {
        return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het toevoegen van tekst',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }
}
