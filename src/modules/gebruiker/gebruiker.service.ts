import { PrismaClient } from '@prisma/client';
import { 
  hashPassword, 
  verifyPassword, 
  generateSecureToken, 
  generateTOTPSecret,
  verifyTOTP,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode 
} from '../../shared/utils/crypto.js';
import { generateAccessToken, generateRefreshToken } from '../../shared/utils/jwt.js';
import { isExpired, addTimeToDate } from '../../shared/utils/helpers.js';
import { logAudit, createLogger } from '../../shared/utils/logger.js';
import { env } from '../../config/env.js';
import { PASSWORD_RULES, ERROR_CODES } from '../../config/constants.js';
import type { 
  Registratie, 
  Login, 
  UpdateProfiel, 
  WijzigWachtwoord,
  GebruikerResponse,
  LoginResponse,
  GebruikerVolledig,
  ProfielStatistieken
} from './gebruiker.dto.js';
import type { ServiceResult, CustomError } from '../../shared/types/index.js';

const logger = createLogger('GebruikerService');

export class GebruikerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Registreer een nieuwe gebruiker
   */
  async registreer(data: Registratie, ipAddress?: string): Promise<ServiceResult<GebruikerResponse>> {
    try {
      // Check of email al bestaat
      const bestaandeGebruiker = await this.prisma.gebruiker.findUnique({
        where: { email: data.email }
      });

      if (bestaandeGebruiker) {
        return {
          success: false,
          error: {
            name: 'ValidationError',
            message: 'Dit email adres is al geregistreerd',
            statusCode: 400,
            code: ERROR_CODES.RESOURCE_ALREADY_EXISTS,
          } as CustomError
        };
      }

      // Hash wachtwoord
      const gehashedWachtwoord = await hashPassword(data.wachtwoord);

      // Maak gebruiker aan
      const gebruiker = await this.prisma.gebruiker.create({
        data: {
          email: data.email,
          voornaam: data.voornaam,
          tussenvoegsel: data.tussenvoegsel,
          achternaam: data.achternaam,
          wachtwoord: gehashedWachtwoord,
        },
        select: {
          id: true,
          email: true,
          voornaam: true,
          tussenvoegsel: true,
          achternaam: true,
          isActief: true,
          emailGeverifieerd: true,
          tweeFAIngeschakeld: true,
          aangemaaktOp: true,
          bijgewerktOp: true,
          laatsteLogin: true,
        }
      });

      // Maak email verificatie token aan
      await this.maakEmailVerificatieToken(gebruiker.id);

      // Log activiteit
      logAudit('GEBRUIKER_GEREGISTREERD', gebruiker.id, undefined, { ipAddress });

      logger.info({ userId: gebruiker.id }, 'Nieuwe gebruiker geregistreerd');

      return {
        success: true,
        data: gebruiker
      };

    } catch (error) {
      logger.error({ err: error }, 'Fout bij registreren gebruiker');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het registreren',
          statusCode: 500,
        } as CustomError
      };
    }
  }

  /**
   * Login gebruiker
   */
  async login(data: Login, ipAddress?: string, userAgent?: string): Promise<ServiceResult<LoginResponse>> {
    try {
      const gebruiker = await this.prisma.gebruiker.findUnique({
        where: { email: data.email },
        include: {
          tweeFATokens: {
            where: {
              type: 'TOTP',
              verlooptOp: { gt: new Date() }
            },
            take: 1
          }
        }
      });

      // Check of gebruiker bestaat
      if (!gebruiker) {
        await this.logFailedLogin(data.email, 'GEBRUIKER_NIET_GEVONDEN', ipAddress, userAgent);
        return {
          success: false,
          error: {
            name: 'AuthenticationError',
            message: 'Ongeldige login gegevens',
            statusCode: 401,
            code: ERROR_CODES.INVALID_CREDENTIALS,
          } as CustomError
        };
      }

      // Check of account actief is
      if (!gebruiker.isActief) {
        await this.logFailedLogin(data.email, 'ACCOUNT_NIET_ACTIEF', ipAddress, userAgent);
        return {
          success: false,
          error: {
            name: 'AuthenticationError',
            message: 'Account is gedeactiveerd',
            statusCode: 401,
            code: ERROR_CODES.ACCOUNT_LOCKED,
          } as CustomError
        };
      }

      // Check of account geblokkeerd is
      if (gebruiker.isGeblokkeerd && gebruiker.geblokkeerTot && new Date() < gebruiker.geblokkeerTot) {
        await this.logFailedLogin(data.email, 'ACCOUNT_GEBLOKKEERD', ipAddress, userAgent);
        const minutesLeft = Math.ceil((gebruiker.geblokkeerTot.getTime() - Date.now()) / (1000 * 60));
        return {
          success: false,
          error: {
            name: 'AuthenticationError',
            message: `Account is tijdelijk geblokkeerd. Probeer over ${minutesLeft} minuten opnieuw.`,
            statusCode: 423,
            code: ERROR_CODES.ACCOUNT_LOCKED,
          } as CustomError
        };
      }

      // Verifieer wachtwoord
      const isWachtwoordCorrect = await verifyPassword(gebruiker.wachtwoord, data.wachtwoord);
      if (!isWachtwoordCorrect) {
        await this.verhoogFailedLogins(gebruiker.id, ipAddress, userAgent);
        return {
          success: false,
          error: {
            name: 'AuthenticationError',
            message: 'Ongeldige login gegevens',
            statusCode: 401,
            code: ERROR_CODES.INVALID_CREDENTIALS,
          } as CustomError
        };
      }

      // Check 2FA indien ingeschakeld
      if (gebruiker.tweeFAIngeschakeld) {
        if (!data.tweeFACode) {
          return {
            success: true,
            data: {
              user: this.formatGebruikerResponse(gebruiker),
              requiresTwoFA: true,
              message: '2FA code vereist'
            }
          };
        }

        const is2FAValid = await this.verifieer2FA(gebruiker.id, data.tweeFACode);
        if (!is2FAValid) {
          await this.logFailedLogin(data.email, 'INVALID_2FA', ipAddress, userAgent);
          return {
            success: false,
            error: {
              name: 'AuthenticationError',
              message: 'Ongeldige 2FA code',
              statusCode: 401,
              code: ERROR_CODES.INVALID_2FA_CODE,
            } as CustomError
          };
        }
      }

      // Reset failed login counter en update laatste login
      await this.prisma.gebruiker.update({
        where: { id: gebruiker.id },
        data: {
          aantalMisluktLogins: 0,
          laatsteMisluktLoginOp: null,
          isGeblokkeerd: false,
          geblokkeerTot: null,
          laatsteLogin: new Date(),
        }
      });

      // Maak sessie aan
      const sessieId = generateSecureToken();
      const sessieExpiryTime = addTimeToDate(new Date(), 24, 'hours'); // 24 uur geldigheidsduur
      
      await this.prisma.sessie.create({
        data: {
          token: sessieId,
          gebruikerId: gebruiker.id,
          ipAdres: ipAddress || 'unknown',
          userAgent: userAgent,
          verlooptOp: sessieExpiryTime,
        }
      });

      // Genereer JWT tokens
      const accessToken = await generateAccessToken(
        gebruiker.id, 
        sessieId
      );
      
      const refreshToken = await generateRefreshToken(gebruiker.id);

      // Log succesvolle login
      await this.logSuccessfulLogin(gebruiker.id, ipAddress, userAgent);

      logger.info({ userId: gebruiker.id, sessionId: sessieId }, 'Gebruiker succesvol ingelogd');

      return {
        success: true,
        data: {
          user: this.formatGebruikerResponse(gebruiker),
          accessToken,
          refreshToken,
          sessionId: sessieId,
          requiresTwoFA: false,
          message: 'Login succesvol'
        }
      };

    } catch (error) {
      logger.error({ err: error }, 'Fout bij inloggen');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het inloggen',
          statusCode: 500,
        } as CustomError
      };
    }
  }

  /**
   * Haal gebruiker op via ID
   */
  async getGebruikerById(id: string): Promise<ServiceResult<GebruikerVolledig>> {
    try {
      const gebruiker = await this.prisma.gebruiker.findUnique({
        where: { id },
        include: {
          organisatieLidmaatschap: {
            include: {
              organisatie: {
                select: {
                  id: true,
                  naam: true,
                  slug: true,
                }
              }
            }
          }
        }
      });

      if (!gebruiker) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Gebruiker niet gevonden',
            statusCode: 404,
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
          } as CustomError
        };
      }

      // Count backup codes
      const backupCodesCount = gebruiker.tweeFABackupCodes.length;

      const result: GebruikerVolledig = {
        ...this.formatGebruikerResponse(gebruiker),
        organisaties: gebruiker.organisatieLidmaatschap.map(lidmaatschap => ({
          id: lidmaatschap.organisatie.id,
          naam: lidmaatschap.organisatie.naam,
          slug: lidmaatschap.organisatie.slug,
          rol: lidmaatschap.rol as 'EIGENAAR' | 'BEHEERDER' | 'MANAGER' | 'LID',
        })),
        tweeFABackupCodesCount: gebruiker.tweeFAIngeschakeld ? backupCodesCount : undefined,
      };

      return {
        success: true,
        data: result
      };

    } catch (error) {
      logger.error({ err: error, userId: id }, 'Fout bij ophalen gebruiker');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het ophalen van gebruiker',
          statusCode: 500,
        } as CustomError
      };
    }
  }

  /**
   * Update gebruiker profiel
   */
  async updateProfiel(id: string, data: UpdateProfiel): Promise<ServiceResult<GebruikerResponse>> {
    try {
      const gebruiker = await this.prisma.gebruiker.update({
        where: { id },
        data: {
          voornaam: data.voornaam,
          tussenvoegsel: data.tussenvoegsel,
          achternaam: data.achternaam,
        },
        select: {
          id: true,
          email: true,
          voornaam: true,
          tussenvoegsel: true,
          achternaam: true,
          isActief: true,
          emailGeverifieerd: true,
          tweeFAIngeschakeld: true,
          aangemaaktOp: true,
          bijgewerktOp: true,
          laatsteLogin: true,
        }
      });

      logAudit('PROFIEL_BIJGEWERKT', id);

      return {
        success: true,
        data: gebruiker
      };

    } catch (error) {
      logger.error({ err: error, userId: id }, 'Fout bij updaten profiel');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het bijwerken van het profiel',
          statusCode: 500,
        } as CustomError
      };
    }
  }

  /**
   * Wijzig wachtwoord
   */
  async wijzigWachtwoord(id: string, data: WijzigWachtwoord): Promise<ServiceResult<{ message: string }>> {
    try {
      const gebruiker = await this.prisma.gebruiker.findUnique({
        where: { id }
      });

      if (!gebruiker) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Gebruiker niet gevonden',
            statusCode: 404,
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
          } as CustomError
        };
      }

      // Verifieer huidig wachtwoord
      const isHuidigWachtwoordCorrect = await verifyPassword(gebruiker.wachtwoord, data.huidigWachtwoord);
      if (!isHuidigWachtwoordCorrect) {
        return {
          success: false,
          error: {
            name: 'ValidationError',
            message: 'Huidig wachtwoord is onjuist',
            statusCode: 400,
            code: ERROR_CODES.INVALID_CREDENTIALS,
          } as CustomError
        };
      }

      // Hash nieuw wachtwoord
      const nieuwGehashedWachtwoord = await hashPassword(data.nieuwWachtwoord);

      // Update wachtwoord
      await this.prisma.gebruiker.update({
        where: { id },
        data: {
          wachtwoord: nieuwGehashedWachtwoord,
          laatsteWachtwoordWijziging: new Date(),
        }
      });

      logAudit('WACHTWOORD_GEWIJZIGD', id);

      return {
        success: true,
        data: { message: 'Wachtwoord succesvol gewijzigd' }
      };

    } catch (error) {
      logger.error({ err: error, userId: id }, 'Fout bij wijzigen wachtwoord');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het wijzigen van het wachtwoord',
          statusCode: 500,
        } as CustomError
      };
    }
  }

  /**
   * Schakel 2FA in
   */
  async schakel2FAIn(userId: string): Promise<ServiceResult<{ secret: string; qrCodeUri: string; backupCodes: string[] }>> {
    try {
      const gebruiker = await this.prisma.gebruiker.findUnique({
        where: { id: userId }
      });

      if (!gebruiker) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Gebruiker niet gevonden',
            statusCode: 404,
          } as CustomError
        };
      }

      if (gebruiker.tweeFAIngeschakeld) {
        return {
          success: false,
          error: {
            name: 'ValidationError',
            message: '2FA is al ingeschakeld',
            statusCode: 400,
            code: ERROR_CODES.TOTP_ALREADY_ENABLED,
          } as CustomError
        };
      }

      // Genereer TOTP secret
      const secret = generateTOTPSecret();
      const qrCodeUri = `otpauth://totp/${env.TOTP_ISSUER}:${gebruiker.email}?secret=${secret}&issuer=${env.TOTP_ISSUER}`;

      // Genereer backup codes
      const backupCodes = generateBackupCodes();
      const hashedBackupCodes = await Promise.all(backupCodes.map(code => hashBackupCode(code)));

      // Update gebruiker
      await this.prisma.gebruiker.update({
        where: { id: userId },
        data: {
          tweeFAGeheim: secret,
          tweeFABackupCodes: hashedBackupCodes,
          tweeFAIngeschakeld: true,
        }
      });

      logAudit('2FA_INGESCHAKELD', userId);

      return {
        success: true,
        data: {
          secret,
          qrCodeUri,
          backupCodes
        }
      };

    } catch (error) {
      logger.error({ err: error, userId }, 'Fout bij inschakelen 2FA');
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het inschakelen van 2FA',
          statusCode: 500,
        } as CustomError
      };
    }
  }

  /**
   * Helper methods
   */
  private formatGebruikerResponse(gebruiker: any): GebruikerResponse {
    return {
      id: gebruiker.id,
      email: gebruiker.email,
      voornaam: gebruiker.voornaam,
      tussenvoegsel: gebruiker.tussenvoegsel,
      achternaam: gebruiker.achternaam,
      isActief: gebruiker.isActief,
      emailGeverifieerd: gebruiker.emailGeverifieerd,
      tweeFAIngeschakeld: gebruiker.tweeFAIngeschakeld,
      aangemaaktOp: gebruiker.aangemaaktOp,
      bijgewerktOp: gebruiker.bijgewerktOp,
      laatsteLogin: gebruiker.laatsteLogin,
    };
  }

  private async maakEmailVerificatieToken(gebruikerId: string): Promise<void> {
    const token = generateSecureToken();
    const verlooptOp = addTimeToDate(new Date(), env.EMAIL_VERIFICATION_EXPIRY_HOURS, 'hours');

    await this.prisma.emailVerificatieToken.create({
      data: {
        gebruikerId,
        token,
        verlooptOp,
      }
    });
  }

  private async logFailedLogin(email: string, reden: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const gebruiker = await this.prisma.gebruiker.findUnique({
      where: { email }
    });

    if (gebruiker) {
      await this.prisma.loginLog.create({
        data: {
          gebruikerId: gebruiker.id,
          isSuccesvol: false,
          ipAdres: ipAddress || 'unknown',
          gebruikersAgent: userAgent,
          foutmelding: reden,
        }
      });
    }
  }

  private async logSuccessfulLogin(gebruikerId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.prisma.loginLog.create({
      data: {
        gebruikerId,
        isSuccesvol: true,
        ipAdres: ipAddress || 'unknown',
        gebruikersAgent: userAgent,
      }
    });
  }

  private async verhoogFailedLogins(gebruikerId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const gebruiker = await this.prisma.gebruiker.findUnique({
      where: { id: gebruikerId }
    });

    if (!gebruiker) return;

    const nieuwAantalMislukt = gebruiker.aantalMisluktLogins + 1;
    const shouldBlock = nieuwAantalMislukt >= PASSWORD_RULES.MAX_FAILED_ATTEMPTS;

    await this.prisma.gebruiker.update({
      where: { id: gebruikerId },
      data: {
        aantalMisluktLogins: nieuwAantalMislukt,
        laatsteMisluktLoginOp: new Date(),
        ...(shouldBlock && {
          isGeblokkeerd: true,
          geblokkeerTot: addTimeToDate(new Date(), PASSWORD_RULES.LOCKOUT_DURATION_MINUTES, 'minutes')
        })
      }
    });

    await this.logFailedLogin(gebruiker.email, 'ONJUIST_WACHTWOORD', ipAddress, userAgent);
  }

  private async verifieer2FA(gebruikerId: string, code: string): Promise<boolean> {
    const gebruiker = await this.prisma.gebruiker.findUnique({
      where: { id: gebruikerId }
    });

    if (!gebruiker || !gebruiker.tweeFAGeheim) {
      return false;
    }

    // Probeer eerst TOTP
    if (verifyTOTP(code, gebruiker.tweeFAGeheim)) {
      return true;
    }

    // Probeer backup codes
    const backupResult = await verifyBackupCode(code, gebruiker.tweeFABackupCodes);
    if (backupResult.isValid) {
      // Verwijder gebruikte backup code
      const updatedCodes = [...gebruiker.tweeFABackupCodes];
      updatedCodes.splice(backupResult.index, 1);

      await this.prisma.gebruiker.update({
        where: { id: gebruikerId },
        data: {
          tweeFABackupCodes: updatedCodes
        }
      });

      return true;
    }

    return false;
  }
}
