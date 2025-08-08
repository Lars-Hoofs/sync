import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '../shared/utils/logger.js';
import { env } from '../config/env.js';
import { ServiceResult } from '../shared/types/index.js';
import { CustomError } from '../shared/utils/errors.js';
import { generateSecureToken } from '../shared/utils/crypto.js';

const logger = createLogger('TwoFAService');

export interface TwoFASetupResult {
  secret: string;
  qrCodeDataUri: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface TwoFAVerificationResult {
  isValid: boolean;
  usedBackupCode?: boolean;
}

export class TwoFAService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate 2FA setup for a user
   */
  async generateSetup(userId: string, userEmail: string): Promise<ServiceResult<TwoFASetupResult>> {
    try {
      // Check if user exists and doesn't already have 2FA enabled
      const user = await this.prisma.gebruiker.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          email: true, 
          tweeFAIngeschakeld: true,
          tweeFAMethodes: true
        }
      });

      if (!user) {
        return {
          success: false,
          error: new CustomError('User not found', 'USER_NOT_FOUND', 404, 'TwoFAService')
        };
      }

      if (user.tweeFAIngeschakeld) {
        return {
          success: false,
          error: new CustomError('2FA is already enabled for this user', '2FA_ALREADY_ENABLED', 400, 'TwoFAService')
        };
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `${env.TOTP_ISSUER} (${userEmail})`,
        issuer: env.TOTP_ISSUER,
        length: 32
      });

      // Generate QR code
      const qrCodeDataUri = await qrcode.toDataURL(secret.otpauth_url!);

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Store temporary setup data (not activated yet)
      await this.prisma.tweeFASetup.create({
        data: {
          gebruikerId: userId,
          secret: secret.base32,
          backupCodes: backupCodes.map(code => ({ code, gebruikt: false })),
          aangemaakt: new Date(),
          verloopdatum: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
        }
      });

      logger.info(`2FA setup generated for user ${userId}`);

      return {
        success: true,
        data: {
          secret: secret.base32,
          qrCodeDataUri,
          backupCodes,
          manualEntryKey: secret.base32
        }
      };
    } catch (error) {
      logger.error('Error generating 2FA setup:', error);
      return {
        success: false,
        error: new CustomError('Failed to generate 2FA setup', '2FA_SETUP_ERROR', 500, 'TwoFAService')
      };
    }
  }

  /**
   * Verify and enable 2FA for a user
   */
  async enable2FA(userId: string, verificationCode: string): Promise<ServiceResult<boolean>> {
    try {
      // Get temporary setup
      const setup = await this.prisma.tweeFASetup.findUnique({
        where: { gebruikerId: userId }
      });

      if (!setup) {
        return {
          success: false,
          error: new CustomError('No 2FA setup found. Please start setup process again.', 'NO_2FA_SETUP', 404, 'TwoFAService')
        };
      }

      if (setup.verloopdatum < new Date()) {
        // Clean up expired setup
        await this.prisma.tweeFASetup.delete({
          where: { gebruikerId: userId }
        });
        
        return {
          success: false,
          error: new CustomError('2FA setup has expired. Please start again.', '2FA_SETUP_EXPIRED', 400, 'TwoFAService')
        };
      }

      // Verify the code
      const isValid = speakeasy.totp.verify({
        secret: setup.secret,
        encoding: 'base32',
        token: verificationCode,
        window: env.TOTP_WINDOW
      });

      if (!isValid) {
        return {
          success: false,
          error: new CustomError('Invalid verification code', 'INVALID_2FA_CODE', 400, 'TwoFAService')
        };
      }

      // Enable 2FA for the user
      await this.prisma.$transaction(async (tx) => {
        // Create 2FA method
        await tx.tweeFAMethode.create({
          data: {
            gebruikerId: userId,
            type: 'TOTP',
            secret: setup.secret,
            isActief: true,
            aangemaakt: new Date()
          }
        });

        // Create backup codes
        for (const backupCode of setup.backupCodes) {
          await tx.tweeFABackupCode.create({
            data: {
              gebruikerId: userId,
              code: backupCode.code,
              gebruikt: false,
              aangemaakt: new Date()
            }
          });
        }

        // Update user
        await tx.gebruiker.update({
          where: { id: userId },
          data: { 
            tweeFAIngeschakeld: true,
            bijgewerkt: new Date()
          }
        });

        // Remove temporary setup
        await tx.tweeFASetup.delete({
          where: { gebruikerId: userId }
        });
      });

      logger.info(`2FA enabled for user ${userId}`);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      logger.error('Error enabling 2FA:', error);
      return {
        success: false,
        error: new CustomError('Failed to enable 2FA', '2FA_ENABLE_ERROR', 500, 'TwoFAService')
      };
    }
  }

  /**
   * Verify a 2FA code
   */
  async verifyCode(userId: string, code: string): Promise<ServiceResult<TwoFAVerificationResult>> {
    try {
      const user = await this.prisma.gebruiker.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          tweeFAIngeschakeld: true,
          tweeFAMethodes: {
            where: { isActief: true },
            select: { secret: true, type: true }
          },
          tweeFABackupCodes: {
            where: { gebruikt: false },
            select: { id: true, code: true }
          }
        }
      });

      if (!user || !user.tweeFAIngeschakeld) {
        return {
          success: false,
          error: new CustomError('2FA not enabled for this user', '2FA_NOT_ENABLED', 400, 'TwoFAService')
        };
      }

      const totpMethod = user.tweeFAMethodes.find(method => method.type === 'TOTP');
      if (!totpMethod) {
        return {
          success: false,
          error: new CustomError('No TOTP method found', 'NO_TOTP_METHOD', 400, 'TwoFAService')
        };
      }

      // Try TOTP verification first
      const isTotpValid = speakeasy.totp.verify({
        secret: totpMethod.secret,
        encoding: 'base32',
        token: code,
        window: env.TOTP_WINDOW
      });

      if (isTotpValid) {
        return {
          success: true,
          data: { isValid: true, usedBackupCode: false }
        };
      }

      // Try backup codes
      const backupCode = user.tweeFABackupCodes.find(backup => backup.code === code);
      if (backupCode) {
        // Mark backup code as used
        await this.prisma.tweeFABackupCode.update({
          where: { id: backupCode.id },
          data: { gebruikt: true, gebruikt_op: new Date() }
        });

        logger.info(`Backup code used for user ${userId}`);

        return {
          success: true,
          data: { isValid: true, usedBackupCode: true }
        };
      }

      return {
        success: true,
        data: { isValid: false }
      };
    } catch (error) {
      logger.error('Error verifying 2FA code:', error);
      return {
        success: false,
        error: new CustomError('Failed to verify 2FA code', '2FA_VERIFY_ERROR', 500, 'TwoFAService')
      };
    }
  }

  /**
   * Disable 2FA for a user
   */
  async disable2FA(userId: string): Promise<ServiceResult<boolean>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Disable 2FA methods
        await tx.tweeFAMethode.updateMany({
          where: { gebruikerId: userId },
          data: { isActief: false }
        });

        // Delete backup codes
        await tx.tweeFABackupCode.deleteMany({
          where: { gebruikerId: userId }
        });

        // Update user
        await tx.gebruiker.update({
          where: { id: userId },
          data: { 
            tweeFAIngeschakeld: false,
            bijgewerkt: new Date()
          }
        });

        // Clean up any pending setups
        await tx.tweeFASetup.deleteMany({
          where: { gebruikerId: userId }
        });
      });

      logger.info(`2FA disabled for user ${userId}`);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      return {
        success: false,
        error: new CustomError('Failed to disable 2FA', '2FA_DISABLE_ERROR', 500, 'TwoFAService')
      };
    }
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<ServiceResult<string[]>> {
    try {
      const user = await this.prisma.gebruiker.findUnique({
        where: { id: userId },
        select: { tweeFAIngeschakeld: true }
      });

      if (!user || !user.tweeFAIngeschakeld) {
        return {
          success: false,
          error: new CustomError('2FA not enabled for this user', '2FA_NOT_ENABLED', 400, 'TwoFAService')
        };
      }

      const newBackupCodes = this.generateBackupCodes();

      await this.prisma.$transaction(async (tx) => {
        // Delete old backup codes
        await tx.tweeFABackupCode.deleteMany({
          where: { gebruikerId: userId }
        });

        // Create new backup codes
        for (const code of newBackupCodes) {
          await tx.tweeFABackupCode.create({
            data: {
              gebruikerId: userId,
              code,
              gebruikt: false,
              aangemaakt: new Date()
            }
          });
        }
      });

      logger.info(`Backup codes regenerated for user ${userId}`);

      return {
        success: true,
        data: newBackupCodes
      };
    } catch (error) {
      logger.error('Error regenerating backup codes:', error);
      return {
        success: false,
        error: new CustomError('Failed to regenerate backup codes', 'BACKUP_CODES_ERROR', 500, 'TwoFAService')
      };
    }
  }

  /**
   * Get 2FA status for a user
   */
  async get2FAStatus(userId: string): Promise<ServiceResult<{
    enabled: boolean;
    methods: string[];
    backupCodesRemaining: number;
    lastUsed?: Date;
  }>> {
    try {
      const user = await this.prisma.gebruiker.findUnique({
        where: { id: userId },
        select: {
          tweeFAIngeschakeld: true,
          tweeFAMethodes: {
            where: { isActief: true },
            select: { type: true, laatstGebruikt: true }
          },
          tweeFABackupCodes: {
            where: { gebruikt: false },
            select: { id: true }
          }
        }
      });

      if (!user) {
        return {
          success: false,
          error: new CustomError('User not found', 'USER_NOT_FOUND', 404, 'TwoFAService')
        };
      }

      const lastUsed = user.tweeFAMethodes.reduce((latest, method) => {
        if (!method.laatstGebruikt) return latest;
        return !latest || method.laatstGebruikt > latest ? method.laatstGebruikt : latest;
      }, null as Date | null);

      return {
        success: true,
        data: {
          enabled: user.tweeFAIngeschakeld,
          methods: user.tweeFAMethodes.map(method => method.type),
          backupCodesRemaining: user.tweeFABackupCodes.length,
          lastUsed: lastUsed || undefined
        }
      };
    } catch (error) {
      logger.error('Error getting 2FA status:', error);
      return {
        success: false,
        error: new CustomError('Failed to get 2FA status', '2FA_STATUS_ERROR', 500, 'TwoFAService')
      };
    }
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-digit codes
      codes.push(generateSecureToken(4).toUpperCase());
    }
    return codes;
  }
}

// Export singleton
export const twoFAService = new TwoFAService(new PrismaClient());
