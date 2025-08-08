import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import { generateSecureToken, generateVerificationCode } from '../../shared/utils/tokens.js';
import { hashPassword, comparePassword } from '../../shared/utils/crypto.js';
import type { ServiceResult } from '../../shared/types/index.js';

const logger = createLogger('BeveiligingService');

export class BeveiligingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Genereer 2FA backup codes
   */
  async genereer2FABackupCodes(gebruikerId: string): Promise<ServiceResult<{ codes: string[] }>> {
    try {
      const codes = Array.from({ length: 8 }, () => generateSecureToken(8).toUpperCase());
      
      await this.prisma.tweeFAToken.create({
        data: {
          gebruikerId,
          token: generateSecureToken(32),
          type: 'BACKUP_CODE',
          verlooptOp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dagen geldig
        }
      });

      return {
        success: true,
        data: { codes }
      };
    } catch (error: any) {
      logger.error({ err: error, gebruikerId }, 'Fout bij genereren 2FA backup codes');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Fout bij genereren backup codes',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Password reset aanvragen
   */
  async vraagPasswordResetAan(email: string): Promise<ServiceResult<{ message: string }>> {
    try {
      const gebruiker = await this.prisma.gebruiker.findUnique({
        where: { email }
      });

      if (!gebruiker) {
        // Geef geen indicatie dat gebruiker niet bestaat (security)
        return {
          success: true,
          data: { message: 'Als het e-mailadres bestaat, is er een reset link verzonden.' }
        };
      }

      const token = generateSecureToken();
      const verlooptOp = new Date();
      verlooptOp.setHours(verlooptOp.getHours() + 1); // 1 uur geldig

      await this.prisma.wachtwoordResetToken.create({
        data: {
          gebruikerId: gebruiker.id,
          token,
          verlooptOp
        }
      });

      // TODO: Verstuur e-mail met reset link
      logger.info({ gebruikerId: gebruiker.id }, 'Password reset aangevraagd');

      return {
        success: true,
        data: { message: 'Als het e-mailadres bestaat, is er een reset link verzonden.' }
      };
    } catch (error: any) {
      logger.error({ err: error, email }, 'Fout bij password reset aanvraag');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Password reset voltooien
   */
  async voltooiPasswordReset(token: string, nieuwPassword: string): Promise<ServiceResult<{ message: string }>> {
    try {
      const resetRecord = await this.prisma.wachtwoordResetToken.findFirst({
        where: {
          token,
          gebruiktOp: null,
          verlooptOp: { gt: new Date() }
        },
        include: { gebruiker: true }
      });

      if (!resetRecord) {
        return {
          success: false,
          error: {
            name: 'BadRequestError',
            message: 'Ongeldige of verlopen reset token',
            code: ERROR_CODES.BAD_REQUEST,
            statusCode: HTTP_STATUS.BAD_REQUEST
          }
        };
      }

      const hashedPassword = await hashPassword(nieuwPassword);

      await this.prisma.$transaction(async (tx) => {
        // Update password
        await tx.gebruiker.update({
          where: { id: resetRecord.gebruikerId },
          data: { 
            wachtwoord: hashedPassword,
            bijgewerktOp: new Date()
          }
        });

        // Mark reset as used
        await tx.wachtwoordResetToken.update({
          where: { id: resetRecord.id },
          data: { 
            gebruiktOp: new Date()
          }
        });

        // Invalidate all sessions
        await tx.sessie.updateMany({
          where: {
            gebruikerId: resetRecord.gebruikerId,
            status: 'ACTIEF'
          },
          data: {
            status: 'UITGELOGD',
            bijgewerktOp: new Date()
          }
        });
      });

      logger.info({ gebruikerId: resetRecord.gebruikerId }, 'Password reset voltooid');

      return {
        success: true,
        data: { message: 'Wachtwoord succesvol gewijzigd' }
      };
    } catch (error: any) {
      logger.error({ err: error }, 'Fout bij voltooien password reset');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het wijzigen van het wachtwoord',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }
}
