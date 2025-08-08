import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { RechtService, RECHTEN } from './recht.service.js';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS } from '../../config/constants.js';
import type { AuthenticatedUser } from '../../shared/types/index.js';

const logger = createLogger('RechtController');

interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

export class RechtController {
  private rechtService: RechtService;

  constructor(prisma: PrismaClient) {
    this.rechtService = new RechtService(prisma);
  }

  async getRechten(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      // Voor deze route geven we alle beschikbare rechten terug (statisch)
      const alleRechten = Object.entries(RECHTEN).flatMap(([categorie, rechten]) =>
        Object.entries(rechten).map(([naam, recht]) => ({
          id: recht,
          naam,
          beschrijving: `${naam} binnen ${categorie}`,
          categorie: categorie.toLowerCase(),
          isActief: true
        }))
      );

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: alleRechten
      });

    } catch (error: any) {
      logger.error({ err: error, userId: request.user.id }, 'Fout bij ophalen rechten');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async getRechtenVoorRol(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { rol } = request.params as { rol: string };
      const result = await this.rechtService.getRechtenVoorRol(rol as any);

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
      logger.error({ err: error, userId: request.user.id }, 'Fout bij ophalen rechten voor rol');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async controleerRecht(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { gebruikerId, rechtNaam } = request.params as { 
        gebruikerId: string; 
        rechtNaam: string; 
      };
      const { organisatieId } = request.query as { organisatieId?: string };

      if (!organisatieId) {
        return reply.code(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: {
            message: 'Organisatie ID is verplicht',
            code: 'MISSING_ORGANISATION_ID'
          }
        });
      }

      const result = await this.rechtService.heeftRecht(
        gebruikerId, 
        organisatieId,
        rechtNaam
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
      logger.error({ err: error, userId: request.user.id }, 'Fout bij controleren recht');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async getGebruikerRechten(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { gebruikerId } = request.params as { gebruikerId: string };
      const { organisatieId } = request.query as { organisatieId: string };

      if (!organisatieId) {
        return reply.code(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: {
            message: 'Organisatie ID is verplicht',
            code: 'MISSING_ORGANISATION_ID'
          }
        });
      }

      const result = await this.rechtService.getGebruikerRechten(
        gebruikerId, 
        organisatieId
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
      logger.error({ err: error, userId: request.user.id }, 'Fout bij ophalen gebruiker rechten');
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
