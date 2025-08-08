import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import ChatBotService from '../../services/chatbot.service.js';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS } from '../../config/constants.js';
import type { AuthenticatedUser } from '../../shared/types/index.js';

const logger = createLogger('WebScrapingController');

interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

export class WebScrapingController {
  private chatBotService: ChatBotService;

  constructor(prisma: PrismaClient) {
    this.chatBotService = new ChatBotService(prisma);
  }

  async startCrawl(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { chatbotId } = request.params as { chatbotId: string };
      const { startUrl, maxDepth, maxPages, includePaths, excludePaths } = request.body as {
        startUrl: string;
        maxDepth?: number;
        maxPages?: number;
        includePaths?: string[];
        excludePaths?: string[];
      };

      const result = await this.chatBotService.startWebsiteCrawl(
        chatbotId,
        startUrl,
        request.user.id,
        {
          maxDepth,
          maxPages,
          includePaths,
          excludePaths
        }
      );

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
        data: {
          crawlId: result.data,
          status: 'started',
          message: 'Website crawl gestart'
        }
      });

    } catch (error: any) {
      logger.error({ 
        err: error, 
        userId: request.user.id, 
        chatbotId: (request.params as any).chatbotId 
      }, 'Fout bij starten website crawl');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async getCrawlStatus(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { crawlId } = request.params as { crawlId: string };

      const result = await this.chatBotService.getCrawlStatus(crawlId, request.user.id);

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
        crawlId: (request.params as any).crawlId 
      }, 'Fout bij ophalen crawl status');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async cancelCrawl(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { crawlId } = request.params as { crawlId: string };

      const result = await this.chatBotService.cancelCrawl(crawlId, request.user.id);

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
        message: 'Crawl succesvol geannuleerd'
      });

    } catch (error: any) {
      logger.error({ 
        err: error, 
        userId: request.user.id, 
        crawlId: (request.params as any).crawlId 
      }, 'Fout bij annuleren crawl');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async scrapePage(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { chatbotId } = request.params as { chatbotId: string };
      const { url } = request.body as { url: string };

      const result = await this.chatBotService.scrapeIndividualPage(
        chatbotId,
        url,
        request.user.id
      );

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
      logger.error({ 
        err: error, 
        userId: request.user.id, 
        chatbotId: (request.params as any).chatbotId 
      }, 'Fout bij scrapen pagina');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async getScrapedContent(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { chatbotId } = request.params as { chatbotId: string };
      const { page = 1, limit = 20, search } = request.query as {
        page?: number;
        limit?: number;
        search?: string;
      };

      const result = await this.chatBotService.getAvailableContent(
        chatbotId,
        request.user.id
      );

      if (!result.success) {
        return reply
          .code(result.error?.statusCode || HTTP_STATUS.NOT_FOUND)
          .send({
            success: false,
            error: result.error
          });
      }

      // Apply pagination and search filtering
      let content = result.data?.content || [];
      
      if (search) {
        content = content.filter((item: any) => 
          item.title?.toLowerCase().includes(search.toLowerCase()) ||
          item.url?.toLowerCase().includes(search.toLowerCase())
        );
      }

      const total = content.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedContent = content.slice(startIndex, endIndex);

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: {
          content: paginatedContent,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error: any) {
      logger.error({ 
        err: error, 
        userId: request.user.id, 
        chatbotId: (request.params as any).chatbotId 
      }, 'Fout bij ophalen gescrapede content');
      
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
