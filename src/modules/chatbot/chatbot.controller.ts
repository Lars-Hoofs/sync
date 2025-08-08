import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ChatbotService } from './chatbot.service.js';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS } from '../../config/constants.js';
import type { 
  MaakChatbot,
  UpdateChatbot,
  MaakDatabron,
  VoegTekstToe 
} from './chatbot.dto.js';
import type { AuthenticatedUser } from '../../shared/types/index.js';

const logger = createLogger('ChatbotController');

interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

export class ChatbotController {
  private chatbotService: ChatbotService;

  constructor(prisma: PrismaClient) {
    this.chatbotService = new ChatbotService(prisma);
  }

  async maakChatbot(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const data = request.body as MaakChatbot;
      const result = await this.chatbotService.maakChatbot(data, request.user.id);

      if (!result.success) {
        return reply
          .code(result.error?.statusCode || HTTP_STATUS.BAD_REQUEST)
          .send({
            success: false,
            error: result.error
          });
      }

      return reply.code(HTTP_STATUS.CREATED).send({
        success: true,
        data: result.data
      });

    } catch (error: any) {
      logger.error({ err: error, userId: request.user.id }, 'Fout bij aanmaken chatbot');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async getChatbots(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const query = request.query as {
        organisatieId?: string;
        status?: string;
        zoekTerm?: string;
        pagina?: number;
        limiet?: number;
      };

      // Placeholder voor nu - gebruik de bestaande service method
      let result;
      if (query.organisatieId) {
        result = await this.chatbotService.getOrganisatieChatbots(query.organisatieId, request.user.id);
        if (result.success) {
          // Converteer naar paginated response
          result = {
            success: true,
            data: {
              chatbots: result.data,
              totaal: result.data?.length || 0,
              pagina: query.pagina || 1,
              limiet: query.limiet || 20
            }
          };
        }
      } else {
        // Placeholder voor alle chatbots van gebruiker
        result = {
          success: true,
          data: {
            chatbots: [],
            totaal: 0,
            pagina: query.pagina || 1,
            limiet: query.limiet || 20
          }
        };
      }

      if (!result.success) {
        return reply
          .code(result.error?.statusCode || HTTP_STATUS.BAD_REQUEST)
          .send({
            success: false,
            error: result.error
          });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: result.data
      });

    } catch (error: any) {
      logger.error({ err: error, userId: request.user.id }, 'Fout bij ophalen chatbots');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async getChatbotById(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { chatbotId } = request.params as { chatbotId: string };
      const result = await this.chatbotService.getChatbotById(chatbotId, request.user.id);

      if (!result.success) {
        return reply
          .code(result.error?.statusCode || HTTP_STATUS.NOT_FOUND)
          .send({
            success: false,
            error: result.error
          });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: result.data
      });

    } catch (error: any) {
      logger.error({ 
        err: error, 
        userId: request.user.id, 
        chatbotId: (request.params as any).chatbotId 
      }, 'Fout bij ophalen chatbot');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async updateChatbot(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { chatbotId } = request.params as { chatbotId: string };
      const data = request.body as UpdateChatbot;
      
      const result = await this.chatbotService.updateChatbot(chatbotId, data, request.user.id);

      if (!result.success) {
        return reply
          .code(result.error?.statusCode || HTTP_STATUS.BAD_REQUEST)
          .send({
            success: false,
            error: result.error
          });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: result.data
      });

    } catch (error: any) {
      logger.error({ err: error, userId: request.user.id }, 'Fout bij updaten chatbot');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async verwijderChatbot(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { chatbotId } = request.params as { chatbotId: string };
      const result = await this.chatbotService.verwijderChatbot(chatbotId, request.user.id);

      if (!result.success) {
        return reply
          .code(result.error?.statusCode || HTTP_STATUS.NOT_FOUND)
          .send({
            success: false,
            error: result.error
          });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        message: result.data?.message || 'Chatbot succesvol verwijderd'
      });

    } catch (error: any) {
      logger.error({ err: error, userId: request.user.id }, 'Fout bij verwijderen chatbot');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async wijzigStatus(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { chatbotId } = request.params as { chatbotId: string };
      const { status } = request.body as { status: string };
      
      const result = await this.chatbotService.wijzigStatus(chatbotId, status as any, request.user.id);

      if (!result.success) {
        return reply
          .code(result.error?.statusCode || HTTP_STATUS.BAD_REQUEST)
          .send({
            success: false,
            error: result.error
          });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        message: result.data?.message || 'Status succesvol gewijzigd'
      });

    } catch (error: any) {
      logger.error({ err: error, userId: request.user.id }, 'Fout bij wijzigen status');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async maakDatabron(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { chatbotId } = request.params as { chatbotId: string };
      const data = request.body as MaakDatabron;
      
      const result = await this.chatbotService.maakDatabron(chatbotId, data, request.user.id);

      if (!result.success) {
        return reply
          .code(result.error?.statusCode || HTTP_STATUS.BAD_REQUEST)
          .send({
            success: false,
            error: result.error
          });
      }

      return reply.code(HTTP_STATUS.CREATED).send({
        success: true,
        data: result.data
      });

    } catch (error: any) {
      logger.error({ err: error, userId: request.user.id }, 'Fout bij aanmaken databron');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async voegTekstToe(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { chatbotId, databronId } = request.params as { 
        chatbotId: string; 
        databronId: string; 
      };
      const data = request.body as VoegTekstToe;
      
      const result = await this.chatbotService.voegTekstToe(databronId, data, request.user.id);

      if (!result.success) {
        return reply
          .code(result.error?.statusCode || HTTP_STATUS.BAD_REQUEST)
          .send({
            success: false,
            error: result.error
          });
      }

      return reply.code(HTTP_STATUS.CREATED).send({
        success: true,
        data: result.data
      });

    } catch (error: any) {
      logger.error({ err: error, userId: request.user.id }, 'Fout bij toevoegen tekst');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }
}
