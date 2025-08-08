import { FastifyRequest, FastifyReply } from 'fastify';
import { UitnodigingService } from './uitnodiging.service.js';
import {
  maakUitnodigingSchema,
  beantwoordUitnodigingSchema,
  updateUitnodigingSchema,
  uitnodigingQuerySchema
} from './uitnodiging.schema.js';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import type {
  MaakUitnodiging,
  BeantwoordUitnodiging,
  UpdateUitnodiging
} from './uitnodiging.dto.js';
import type { ApiResponse } from '../../shared/types/index.js';

const logger = createLogger('UitnodigingController');

export class UitnodigingController {
  constructor(private uitnodigingService: UitnodigingService) {}

  /**
   * POST /api/v1/organisaties/:organisatieId/uitnodigingen
   * Stuur nieuwe uitnodiging
   */
  async stuurUitnodiging(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const { organisatieId } = request.params as { organisatieId: string };
      const bodyData = request.body as any;
      const validatedData = maakUitnodigingSchema.parse({
        ...bodyData,
        organisatieId
      });
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.uitnodigingService.stuurUitnodiging(validatedData as any, userId);

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: result.error!.message,
          errors: [{
            field: 'general',
            message: result.error!.message,
            code: result.error!.code
          }]
        });
      }

      return reply.code(HTTP_STATUS.CREATED).send({
        success: true,
        data: result.data,
        message: result.data!.message
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij versturen uitnodiging');
      
      if (error.name === 'ZodError') {
        return reply.code(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: 'Validatie fouten',
          errors: error.issues.map((issue: any) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: ERROR_CODES.VALIDATION_ERROR
          }))
        });
      }

      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * POST /api/v1/uitnodigingen/:token/beantwoord
   * Beantwoord uitnodiging
   */
  async beantwoordUitnodiging(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const { token } = request.params as { token: string };
      const bodyData = request.body as any;
      const validatedData = beantwoordUitnodigingSchema.parse(bodyData);
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Je moet ingelogd zijn om uitnodigingen te beantwoorden'
        });
      }

      const result = await this.uitnodigingService.beantwoordUitnodiging(token, validatedData as any, userId);

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: result.error!.message,
          errors: [{
            field: 'general',
            message: result.error!.message,
            code: result.error!.code
          }]
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        message: result.data!.message
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij beantwoorden uitnodiging');
      
      if (error.name === 'ZodError') {
        return reply.code(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: 'Validatie fouten',
          errors: error.issues.map((issue: any) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: ERROR_CODES.VALIDATION_ERROR
          }))
        });
      }

      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * GET /api/v1/uitnodigingen/:token
   * Haal publieke uitnodiging informatie op
   */
  async getPubliekeUitnodiging(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const { token } = request.params as { token: string };

      const result = await this.uitnodigingService.getPubliekeUitnodiging(token);

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.NOT_FOUND).send({
          success: false,
          message: result.error!.message,
          errors: [{
            field: 'general',
            message: result.error!.message,
            code: result.error!.code
          }]
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: result.data
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij ophalen publieke uitnodiging');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * GET /api/v1/organisaties/:organisatieId/uitnodigingen
   * Haal uitnodigingen van organisatie op
   */
  async getOrganisatieUitnodigingen(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const { organisatieId } = request.params as { organisatieId: string };
      const queryParams = uitnodigingQuerySchema.parse(request.query);
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.uitnodigingService.getOrganisatieUitnodigingen(
        organisatieId, 
        userId, 
        queryParams
      );

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.FORBIDDEN).send({
          success: false,
          message: result.error!.message,
          errors: [{
            field: 'general',
            message: result.error!.message,
            code: result.error!.code
          }]
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: result.data
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij ophalen organisatie uitnodigingen');
      
      if (error.name === 'ZodError') {
        return reply.code(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: 'Ongeldige query parameters',
          errors: error.issues.map((issue: any) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: ERROR_CODES.VALIDATION_ERROR
          }))
        });
      }

      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * GET /api/v1/gebruikers/uitnodigingen
   * Haal mijn openstaande uitnodigingen op
   */
  async getMijnUitnodigingen(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.uitnodigingService.getMijnUitnodigingen(userId);

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: result.error!.message,
          errors: [{
            field: 'general',
            message: result.error!.message,
            code: result.error!.code
          }]
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: result.data
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij ophalen mijn uitnodigingen');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * DELETE /api/v1/uitnodigingen/:id
   * Intrek uitnodiging
   */
  async intrekUitnodiging(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const { id } = request.params as { id: string };
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.uitnodigingService.intrekUitnodiging(id, userId);

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: result.error!.message,
          errors: [{
            field: 'general',
            message: result.error!.message,
            code: result.error!.code
          }]
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        message: result.data!.message
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij intrekken uitnodiging');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * GET /api/v1/uitnodigingen/:token/quick-accept
   * Snelle acceptatie van uitnodiging (voor bestaande gebruikers)
   */
  async quickAcceptUitnodiging(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const { token } = request.params as { token: string };
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Je moet ingelogd zijn om deze actie uit te voeren'
        });
      }

      const result = await this.uitnodigingService.beantwoordUitnodiging(
        token, 
        { accepteer: true }, 
        userId
      );

      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          message: result.error!.message,
          errors: [{
            field: 'general',
            message: result.error!.message,
            code: result.error!.code
          }]
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        message: result.data!.message
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij quick accept uitnodiging');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }
}
