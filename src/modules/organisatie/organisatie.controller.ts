import { FastifyRequest, FastifyReply } from 'fastify';
import { OrganisatieService } from './organisatie.service.js';
import {
  maakOrganisatieSchema,
  updateOrganisatieSchema,
  wijzigLidRolSchema
} from './organisatie.schema.js';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import type {
  MaakOrganisatie,
  UpdateOrganisatie,
  WijzigLidRol
} from './organisatie.dto.js';
import type { ApiResponse } from '../../shared/types/index.js';

const logger = createLogger('OrganisatieController');

export class OrganisatieController {
  constructor(private organisatieService: OrganisatieService) {}

  /**
   * POST /api/v1/organisaties
   * Maak nieuwe organisatie aan
   */
  async maakOrganisatie(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const validatedData = maakOrganisatieSchema.parse(request.body);
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.organisatieService.maakOrganisatie(validatedData, userId);

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
        message: 'Organisatie succesvol aangemaakt'
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij aanmaken organisatie');
      
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
   * GET /api/v1/organisaties/:id
   * Haal organisatie op
   */
  async getOrganisatie(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const { id } = request.params as { id: string };
      const userId = (request as any).user?.id;

      const result = await this.organisatieService.getOrganisatieById(id, userId);

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
      logger.error({ err: error, requestId: request.id }, 'Fout bij ophalen organisatie');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * PUT /api/v1/organisaties/:id
   * Update organisatie
   */
  async updateOrganisatie(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const { id } = request.params as { id: string };
      const validatedData = updateOrganisatieSchema.parse(request.body);
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.organisatieService.updateOrganisatie(id, validatedData, userId);

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
        data: result.data,
        message: 'Organisatie succesvol bijgewerkt'
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij updaten organisatie');
      
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
   * GET /api/v1/organisaties/:id/leden
   * Haal organisatie leden op
   */
  async getOrganisatieLeden(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const { id } = request.params as { id: string };
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.organisatieService.getOrganisatieLeden(id, userId);

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
      logger.error({ err: error, requestId: request.id }, 'Fout bij ophalen leden');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * PATCH /api/v1/organisaties/:id/leden/:lidmaatschapId/rol
   * Wijzig rol van lid
   */
  async wijzigLidRol(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const { id, lidmaatschapId } = request.params as { id: string; lidmaatschapId: string };
      const validatedData = wijzigLidRolSchema.parse(request.body);
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.organisatieService.wijzigLidRol(id, lidmaatschapId, validatedData, userId);

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
        data: result.data,
        message: 'Rol succesvol gewijzigd'
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij wijzigen rol');
      
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
   * DELETE /api/v1/organisaties/:id/leden/:lidmaatschapId
   * Verwijder lid uit organisatie
   */
  async verwijderLid(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const { id, lidmaatschapId } = request.params as { id: string; lidmaatschapId: string };
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      const result = await this.organisatieService.verwijderLid(id, lidmaatschapId, userId);

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
      logger.error({ err: error, requestId: request.id }, 'Fout bij verwijderen lid');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }

  /**
   * GET /api/v1/gebruikers/organisaties
   * Haal organisaties van huidige gebruiker op
   */
  async getMijnOrganisaties(request: FastifyRequest, reply: FastifyReply): Promise<ApiResponse> {
    try {
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
          success: false,
          message: 'Niet geautoriseerd'
        });
      }

      // Haal alle organisaties op waar gebruiker lid van is
      const lidmaatschappen = await (request.server as any).prisma.organisatieLidmaatschap.findMany({
        where: {
          gebruikerId: userId,
          isActief: true,
        },
        include: {
          organisatie: {
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
          }
        },
        orderBy: {
          aangemaaktOp: 'desc'
        }
      });

      const organisaties = lidmaatschappen.map(lidmaatschap => ({
        ...lidmaatschap.organisatie,
        mijnRol: lidmaatschap.rol,
        lidSinds: lidmaatschap.aangemaaktOp,
      }));

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: organisaties
      });

    } catch (error: any) {
      logger.error({ err: error, requestId: request.id }, 'Fout bij ophalen mijn organisaties');
      
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: 'Er is een onverwachte fout opgetreden'
      });
    }
  }
}
