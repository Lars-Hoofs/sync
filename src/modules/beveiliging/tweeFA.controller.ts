import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { TwoFAService } from '../../services/twofa.service.js';
import { emailService } from '../../services/email.service.js';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS } from '../../config/constants.js';
import { env } from '../../config/env.js';
import type { AuthenticatedUser } from '../../shared/types/index.js';

const logger = createLogger('TweeFAController');

interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

interface Enable2FABody {
  verificationCode: string;
}

interface Verify2FABody {
  code: string;
}

export class TweeFAController {
  private twoFAService: TwoFAService;

  constructor(prisma: PrismaClient) {
    this.twoFAService = new TwoFAService(prisma);
  }

  async schakel2FAIn(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const result = await this.twoFAService.generateSetup(request.user.id, request.user.email);
      
      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: {
            message: result.error!.message,
            code: result.error!.code
          }
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: {
          secret: result.data!.secret,
          qrCodeDataUri: result.data!.qrCodeDataUri,
          backupCodes: result.data!.backupCodes,
          manualEntryKey: result.data!.manualEntryKey,
          message: 'Scan de QR code met je authenticator app en voer de code in om 2FA in te schakelen'
        }
      });
    } catch (error: any) {
      logger.error({ err: error, userId: request.user.id }, 'Fout bij inschakelen 2FA');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async bevestig2FA(request: AuthenticatedRequest & { body: Enable2FABody }, reply: FastifyReply) {
    try {
      const { verificationCode } = request.body;
      const result = await this.twoFAService.enable2FA(request.user.id, verificationCode);
      
      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: {
            message: result.error!.message,
            code: result.error!.code
          }
        });
      }

      // Send confirmation email if configured
      if (emailService.configured) {
        await emailService.send2FASetup(
          request.user.email,
          `${request.user.voornaam} ${request.user.achternaam}`,
          ''
        );
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        message: '2FA is succesvol ingeschakeld voor je account'
      });
    } catch (error: any) {
      logger.error({ err: error, userId: request.user.id }, 'Fout bij bevestigen 2FA');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async schakel2FAUit(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const result = await this.twoFAService.disable2FA(request.user.id);
      
      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: {
            message: result.error!.message,
            code: result.error!.code
          }
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        message: '2FA is uitgeschakeld voor je account'
      });
    } catch (error: any) {
      logger.error({ err: error, userId: request.user.id }, 'Fout bij uitschakelen 2FA');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async regenereerBackupCodes(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const result = await this.twoFAService.regenerateBackupCodes(request.user.id);
      
      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: {
            message: result.error!.message,
            code: result.error!.code
          }
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: {
          backupCodes: result.data!,
          message: 'Nieuwe backup codes gegenereerd. Sla deze veilig op!'
        }
      });
    } catch (error: any) {
      logger.error({ err: error, userId: request.user.id }, 'Fout bij regenereren backup codes');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async get2FAStatus(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const result = await this.twoFAService.get2FAStatus(request.user.id);
      
      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: {
            message: result.error!.message,
            code: result.error!.code
          }
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: {
          is2FAIngeschakeld: result.data!.enabled,
          methodes: result.data!.methods,
          aantalBackupCodes: result.data!.backupCodesRemaining,
          laatsteGebruiktOp: result.data!.lastUsed
        }
      });
    } catch (error: any) {
      logger.error({ err: error, userId: request.user.id }, 'Fout bij ophalen 2FA status');
      return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: {
          message: 'Er is een interne fout opgetreden',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }

  async verifieer2FACode(request: AuthenticatedRequest & { body: Verify2FABody }, reply: FastifyReply) {
    try {
      const { code } = request.body;
      const result = await this.twoFAService.verifyCode(request.user.id, code);
      
      if (!result.success) {
        return reply.code(result.error!.statusCode || HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: {
            message: result.error!.message,
            code: result.error!.code
          }
        });
      }

      return reply.code(HTTP_STATUS.OK).send({
        success: true,
        data: {
          geldig: result.data!.isValid,
          usedBackupCode: result.data!.usedBackupCode,
          type: result.data!.usedBackupCode ? 'BACKUP' : 'TOTP'
        }
      });
    } catch (error: any) {
      logger.error({ err: error, userId: request.user.id }, 'Fout bij verifiëren 2FA code');
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
