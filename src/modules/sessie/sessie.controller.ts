import { FastifyRequest, FastifyReply } from 'fastify';
import { SessieService } from './sessie.service.js';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import type { ApiResponse } from '../../shared/types/index.js';

const logger = createLogger('SessieController');

export class SessieController {
  constructor(private sessieService: SessieService) {}

  /**
   * GET /api/v1/gebruikers/sessies - Haal actieve sessies op
   */
  async getActieveSessies(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const userId = (request as any).user?.id;
      const huidigeSessieId = (request as any).session?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.sessieService.getActieveSessies(userId, huidigeSessieId);

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: result.error!.message
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: result.data
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij ophalen actieve sessies');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * DELETE /api/v1/sessies/:id - Beëindig specifieke sessie
   */
  async beeindigSessie(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const { id } = request.params as { id: string };
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.sessieService.beeindigSessie(id, userId);

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: result.error!.message
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        message: result.data!.message
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij beëindigen sessie');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * DELETE /api/v1/gebruikers/sessies/andere - Beëindig alle andere sessies
   */
  async beeindigAndereSessies(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const userId = (request as any).user?.id;
      const huidigeSessieId = (request as any).session?.id;

      if (!userId || !huidigeSessieId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.sessieService.beeindigAndereSessies(userId, huidigeSessieId);

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: result.error!.message
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        message: result.data!.message,
        data: { aantal: result.data!.aantal }
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij beëindigen andere sessies');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }
}
