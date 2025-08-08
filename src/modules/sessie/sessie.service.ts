import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import { generateSecureToken } from '../../shared/utils/tokens.js';
import type { ServiceResult } from '../../shared/types/index.js';
import type {
  MaakSessie,
  UpdateSessie,
  SessieDetail,
  SessieOverzicht,
  ActieveSessies,
  SessieStatistieken,
  SessieResponse
} from './sessie.dto.js';
import type { SessieStatus } from './sessie.types.js';
import { DeviceType } from './sessie.types.js';

const logger = createLogger('SessieService');

export class SessieService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Maak nieuwe sessie aan bij login
   */
  async maakSessie(data: MaakSessie): Promise<ServiceResult<SessieResponse>> {
    try {
      // Bepaal vervaldatum (24 uur standaard)
      const verlooptOp = new Date();
      verlooptOp.setHours(verlooptOp.getHours() + 24);

      // Genereer unieke token
      const token = generateSecureToken(32);

      // Parse device informatie uit user agent
      const deviceInfo = this.parseUserAgent(data.userAgent);

      const sessie = await this.prisma.sessie.create({
        data: {
          gebruikerId: data.gebruikerId,
          token,
          status: 'ACTIEF',
          ipAdres: data.ipAdres,
          userAgent: data.userAgent,
          deviceType: data.device?.type || deviceInfo.type,
          browser: data.device?.browser || deviceInfo.browser,
          os: data.device?.os || deviceInfo.os,
          isMobile: data.device?.isMobile ?? deviceInfo.isMobile,
          laatsteActiviteit: new Date(),
          verlooptOp
        }
      });

      logger.info({
        sessieId: sessie.id,
        gebruikerId: data.gebruikerId,
        ipAdres: data.ipAdres,
        deviceType: sessie.deviceType
      }, 'Nieuwe sessie aangemaakt');

      return {
        success: true,
        data: {
          id: sessie.id,
          token,
          status: sessie.status as SessieStatus,
          verlooptOp: sessie.verlooptOp,
          message: 'Sessie succesvol aangemaakt'
        }
      };

    } catch (error: any) {
      logger.error({ err: error, data }, 'Fout bij aanmaken sessie');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het aanmaken van de sessie',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Valideer sessie token
   */
  async validateerSessie(token: string): Promise<ServiceResult<SessieDetail>> {
    try {
      const sessie = await this.prisma.sessie.findFirst({
        where: {
          token,
          status: 'ACTIEF',
          verlooptOp: {
            gt: new Date()
          }
        },
        include: {
          gebruiker: {
            select: {
              id: true,
              voornaam: true,
              tussenvoegsel: true,
              achternaam: true,
              email: true
            }
          }
        }
      });

      if (!sessie) {
        return {
          success: false,
          error: {
            name: 'AuthenticationError',
            message: 'Ongeldige of verlopen sessie',
            code: ERROR_CODES.UNAUTHORIZED,
            statusCode: HTTP_STATUS.UNAUTHORIZED
          }
        };
      }

      // Update laatste activiteit
      await this.prisma.sessie.update({
        where: { id: sessie.id },
        data: { laatsteActiviteit: new Date() }
      });

      return {
        success: true,
        data: {
          id: sessie.id,
          gebruikerId: sessie.gebruikerId,
          token: sessie.token,
          status: sessie.status as SessieStatus,
          ipAdres: sessie.ipAdres,
          userAgent: sessie.userAgent,
          deviceType: sessie.deviceType as DeviceType,
          browser: sessie.browser,
          os: sessie.os,
          isMobile: sessie.isMobile,
          laatsteActiviteit: sessie.laatsteActiviteit,
          verlooptOp: sessie.verlooptOp,
          aangemaaktOp: sessie.aangemaaktOp,
          bijgewerktOp: sessie.bijgewerktOp,
          gebruiker: sessie.gebruiker
        }
      };

    } catch (error: any) {
      logger.error({ err: error, token: '***' }, 'Fout bij valideren sessie');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het valideren van de sessie',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Beëindig sessie (logout)
   */
  async beeindigSessie(sessieId: string, gebruikerId: string, reden?: string): Promise<ServiceResult<{ message: string }>> {
    try {
      const sessie = await this.prisma.sessie.findFirst({
        where: {
          id: sessieId,
          gebruikerId,
          status: 'ACTIEF'
        }
      });

      if (!sessie) {
        return {
          success: false,
          error: {
            name: 'NotFoundError',
            message: 'Sessie niet gevonden of al beëindigd',
            code: ERROR_CODES.NOT_FOUND,
            statusCode: HTTP_STATUS.NOT_FOUND
          }
        };
      }

      await this.prisma.sessie.update({
        where: { id: sessieId },
        data: {
          status: 'UITGELOGD',
          bijgewerktOp: new Date()
        }
      });

      logger.info({
        sessieId,
        gebruikerId,
        reden
      }, 'Sessie beëindigd');

      return {
        success: true,
        data: {
          message: 'Sessie succesvol beëindigd'
        }
      };

    } catch (error: any) {
      logger.error({ err: error, sessieId, gebruikerId }, 'Fout bij beëindigen sessie');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het beëindigen van de sessie',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Haal actieve sessies van gebruiker op
   */
  async getActieveSessies(gebruikerId: string, huidigeSessieId?: string): Promise<ServiceResult<ActieveSessies>> {
    try {
      const sessies = await this.prisma.sessie.findMany({
        where: {
          gebruikerId,
          status: 'ACTIEF',
          verlooptOp: {
            gt: new Date()
          }
        },
        orderBy: {
          laatsteActiviteit: 'desc'
        }
      });

      const sessieOverzicht: SessieOverzicht[] = sessies.map(sessie => ({
        id: sessie.id,
        status: sessie.status as SessieStatus,
        ipAdres: sessie.ipAdres,
        deviceType: sessie.deviceType as DeviceType,
        browser: sessie.browser,
        os: sessie.os,
        isMobile: sessie.isMobile,
        isHuidigeSessie: sessie.id === huidigeSessieId,
        laatsteActiviteit: sessie.laatsteActiviteit,
        aangemaaktOp: sessie.aangemaaktOp,
        // TODO: Implementeer IP geolocation voor locatie
        locatie: undefined
      }));

      const huidigeSessie = huidigeSessieId 
        ? sessieOverzicht.find(s => s.id === huidigeSessieId)
        : undefined;

      return {
        success: true,
        data: {
          totaalActief: sessies.length,
          sessies: sessieOverzicht,
          huidigeSessie
        }
      };

    } catch (error: any) {
      logger.error({ err: error, gebruikerId }, 'Fout bij ophalen actieve sessies');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het ophalen van actieve sessies',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Beëindig alle andere sessies behalve huidige
   */
  async beeindigAndereSessies(gebruikerId: string, huidigeSessieId: string): Promise<ServiceResult<{ message: string; aantal: number }>> {
    try {
      const result = await this.prisma.sessie.updateMany({
        where: {
          gebruikerId,
          status: 'ACTIEF',
          id: {
            not: huidigeSessieId
          }
        },
        data: {
          status: 'UITGELOGD',
          bijgewerktOp: new Date()
        }
      });

      logger.info({
        gebruikerId,
        huidigeSessieId,
        beëindigdeSessies: result.count
      }, 'Andere sessies beëindigd');

      return {
        success: true,
        data: {
          message: `${result.count} andere sessie(s) succesvol beëindigd`,
          aantal: result.count
        }
      };

    } catch (error: any) {
      logger.error({ err: error, gebruikerId, huidigeSessieId }, 'Fout bij beëindigen andere sessies');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het beëindigen van andere sessies',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Parse User-Agent string voor device informatie
   */
  private parseUserAgent(userAgent: string): {
    type: DeviceType;
    browser?: string;
    os?: string;
    isMobile: boolean;
  } {
    const ua = userAgent.toLowerCase();
    
    // Device type detectie
    let type: DeviceType = DeviceType.UNKNOWN;
    let isMobile = false;

    if (ua.includes('mobile') || ua.includes('android')) {
      type = DeviceType.MOBILE;
      isMobile = true;
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      type = DeviceType.TABLET;
      isMobile = true;
    } else if (ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux')) {
      type = DeviceType.DESKTOP;
    }

    // Browser detectie
    let browser: string | undefined;
    if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    else if (ua.includes('opera')) browser = 'Opera';

    // OS detectie
    let os: string | undefined;
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('macintosh')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('ios')) os = 'iOS';

    return {
      type,
      browser,
      os,
      isMobile
    };
  }
}
