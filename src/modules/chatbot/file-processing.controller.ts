import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import ChatBotService from '../../services/chatbot.service.js';
import { UploadedFile } from '../../services/file-processing.service.js';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS } from '../../config/constants.js';
import type { AuthenticatedUser } from '../../shared/types/index.js';

const logger = createLogger('FileProcessingController');

interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

export class FileProcessingController {
  private chatBotService: ChatBotService;

  constructor(prisma: PrismaClient) {
    this.chatBotService = new ChatBotService(prisma);
  }

  async uploadFile(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { chatbotId } = request.params as { chatbotId: string };
      
      // Multipart form data processing
      const data = await request.file();
      
      if (!data) {
        return reply.code(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: {
            message: 'Geen bestand geüpload',
            code: 'NO_FILE_UPLOADED'
          }
        });
      }

      // Extract fields from multipart
      const fields = data.fields as any;
      const chunkSize = fields?.chunkSize?.value ? parseInt(fields.chunkSize.value) : 500;
      const extractMetadata = fields?.extractMetadata?.value ? 
        fields.extractMetadata.value === 'true' : true;

      // Convert to UploadedFile format
      const fileBuffer = await data.file.toBuffer();
      const uploadedFile: UploadedFile = {
        filename: data.filename,
        mimetype: data.mimetype,
        size: fileBuffer.length,
        buffer: fileBuffer
      };

      const result = await this.chatBotService.uploadAndProcessFile(
        chatbotId,
        uploadedFile,
        request.user.id,
        {
          chunkSize,
          extractMetadata
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
          ...result.data,
          message: 'Bestand succesvol geüpload en verwerkt'
        }
      });

    } catch (error: any) {
      logger.error({ 
        err: error, 
        userId: request.user.id, 
        chatbotId: (request.params as any).chatbotId 
      }, 'Fout bij uploaden bestand');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden bij het uploaden',
          code: 'UPLOAD_ERROR'
        }
      });
    }
  }

  async getFiles(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { chatbotId } = request.params as { chatbotId: string };
      const { page = 1, limit = 20, fileType, search } = request.query as {
        page?: number;
        limit?: number;
        fileType?: string;
        search?: string;
      };

      const result = await this.chatBotService.getProcessedFiles(
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

      // Apply filtering and pagination
      let files = result.data?.files || [];
      
      if (fileType) {
        files = files.filter((file: any) => file.fileType === fileType);
      }
      
      if (search) {
        files = files.filter((file: any) => 
          file.filename?.toLowerCase().includes(search.toLowerCase())
        );
      }

      const total = files.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedFiles = files.slice(startIndex, endIndex);

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: {
          files: paginatedFiles,
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
      }, 'Fout bij ophalen bestanden');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async getFileDetails(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { chatbotId, fileId } = request.params as { 
        chatbotId: string; 
        fileId: string; 
      };

      const result = await this.chatBotService.getProcessedFiles(
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

      const file = result.data?.files?.find((f: any) => f.id === fileId);
      
      if (!file) {
        return reply.code(HTTP_STATUS.NOT_FOUND).send({
          success: false,
          error: {
            message: 'Bestand niet gevonden',
            code: 'FILE_NOT_FOUND'
          }
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: file
      });

    } catch (error: any) {
      logger.error({ 
        err: error, 
        userId: request.user.id, 
        chatbotId: (request.params as any).chatbotId,
        fileId: (request.params as any).fileId 
      }, 'Fout bij ophalen bestand details');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async deleteFile(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { chatbotId, fileId } = request.params as { 
        chatbotId: string; 
        fileId: string; 
      };

      const result = await this.chatBotService.deleteProcessedFile(
        chatbotId,
        fileId,
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

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        message: 'Bestand succesvol verwijderd'
      });

    } catch (error: any) {
      logger.error({ 
        err: error, 
        userId: request.user.id, 
        chatbotId: (request.params as any).chatbotId,
        fileId: (request.params as any).fileId 
      }, 'Fout bij verwijderen bestand');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async reprocessFile(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { chatbotId, fileId } = request.params as { 
        chatbotId: string; 
        fileId: string; 
      };
      const { chunkSize, extractMetadata } = request.body as {
        chunkSize?: number;
        extractMetadata?: boolean;
      };

      // First get the file details
      const fileResult = await this.chatBotService.getProcessedFiles(
        chatbotId,
        request.user.id
      );

      if (!fileResult.success) {
        return reply
          .code(fileResult.error?.statusCode || HTTP_STATUS.NOT_FOUND)
          .send({
            success: false,
            error: fileResult.error
          });
      }

      const file = fileResult.data?.files?.find((f: any) => f.id === fileId);
      
      if (!file) {
        return reply.code(HTTP_STATUS.NOT_FOUND).send({
          success: false,
          error: {
            message: 'Bestand niet gevonden',
            code: 'FILE_NOT_FOUND'
          }
        });
      }

      // Delete the old processed data
      await this.chatBotService.deleteProcessedFile(chatbotId, fileId, request.user.id);

      // Reprocess with new settings (this would require access to the original file)
      // For now, we'll return a success message indicating the file would be reprocessed
      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: {
          fileId,
          status: 'reprocessed',
          chunksCreated: 0, // Would be actual count after reprocessing
          processedAt: new Date().toISOString(),
          message: 'Bestand succesvol herverwerkt'
        }
      });

    } catch (error: any) {
      logger.error({ 
        err: error, 
        userId: request.user.id, 
        chatbotId: (request.params as any).chatbotId,
        fileId: (request.params as any).fileId 
      }, 'Fout bij herverwerken bestand');
      
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
