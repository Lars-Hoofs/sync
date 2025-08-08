import { PrismaClient } from '@prisma/client';
import { createLogger } from '../../shared/utils/logger.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import type { ServiceResult } from '../../shared/types/index.js';

const logger = createLogger('LoggingService');

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

export enum LogCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  ORGANISATION = 'ORGANISATION',
  CHATBOT = 'CHATBOT',
  INVITATION = 'INVITATION',
  SESSION = 'SESSION',
  BILLING = 'BILLING',
  SYSTEM = 'SYSTEM'
}

export interface LogEntry {
  id: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: Record<string, any>;
  gebruikerId?: string;
  organisatieId?: string;
  ipAdres?: string;
  userAgent?: string;
  requestId?: string;
  timestamp: Date;
  gebruiker?: {
    id: string;
    email: string;
    voornaam: string;
    achternaam: string;
  };
  organisatie?: {
    id: string;
    naam: string;
  };
}

export interface AuditLogFilters {
  level?: LogLevel;
  category?: LogCategory;
  gebruikerId?: string;
  organisatieId?: string;
  van?: Date;
  tot?: Date;
  zoekterm?: string;
  limit?: number;
  offset?: number;
}

export class LoggingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Log een gebeurtenis
   */
  async log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: {
      gebruikerId?: string;
      organisatieId?: string;
      ipAdres?: string;
      userAgent?: string;
      requestId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<ServiceResult<{ id: string }>> {
    try {
      const logEntry = await this.prisma.auditLog.create({
        data: {
          level,
          category,
          message,
          details: details?.metadata || {},
          gebruikerId: details?.gebruikerId,
          organisatieId: details?.organisatieId,
          ipAdres: details?.ipAdres,
          userAgent: details?.userAgent,
          requestId: details?.requestId
        }
      });

      // Log ook naar console/file logger
      const logData = {
        logId: logEntry.id,
        level,
        category,
        message,
        ...details
      };

      switch (level) {
        case LogLevel.DEBUG:
          logger.debug(logData, message);
          break;
        case LogLevel.INFO:
          logger.info(logData, message);
          break;
        case LogLevel.WARN:
          logger.warn(logData, message);
          break;
        case LogLevel.ERROR:
          logger.error(logData, message);
          break;
        case LogLevel.FATAL:
          logger.fatal(logData, message);
          break;
      }

      return {
        success: true,
        data: { id: logEntry.id }
      };

    } catch (error: any) {
      // Fallback naar console logger als database logging faalt
      logger.error({ err: error, level, category, message }, 'Database logging failed');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het loggen',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Haal audit logs op
   */
  async getAuditLogs(filters: AuditLogFilters, gebruikerId: string): Promise<ServiceResult<{
    logs: LogEntry[];
    totaal: number;
    heeftMeer: boolean;
  }>> {
    try {
      // Controleer admin rechten of organisatie toegang
      const gebruiker = await this.prisma.gebruiker.findUnique({
        where: { id: gebruikerId }
      });

      const isAdmin = gebruiker?.isAdmin || false;
      const organisatieIds: string[] = [];

      if (!isAdmin) {
        // Haal organisaties op waar gebruiker lid van is
        const lidmaatschappen = await this.prisma.organisatieLidmaatschap.findMany({
          where: {
            gebruikerId,
            isActief: true,
            rol: { in: ['EIGENAAR', 'BEHEERDER'] } // Alleen admins kunnen logs bekijken
          },
          select: { organisatieId: true }
        });

        organisatieIds.push(...lidmaatschappen.map(l => l.organisatieId));

        if (organisatieIds.length === 0) {
          return {
            success: false,
            error: {
              name: 'PermissionError',
              message: 'Geen toegang tot audit logs',
              code: ERROR_CODES.FORBIDDEN,
              statusCode: HTTP_STATUS.FORBIDDEN
            }
          };
        }
      }

      // Bouw where clausule
      const where: any = {};

      if (filters.level) where.level = filters.level;
      if (filters.category) where.category = filters.category;
      if (filters.gebruikerId) where.gebruikerId = filters.gebruikerId;
      
      if (filters.organisatieId) {
        if (!isAdmin && !organisatieIds.includes(filters.organisatieId)) {
          return {
            success: false,
            error: {
              name: 'PermissionError',
              message: 'Geen toegang tot deze organisatie logs',
              code: ERROR_CODES.FORBIDDEN,
              statusCode: HTTP_STATUS.FORBIDDEN
            }
          };
        }
        where.organisatieId = filters.organisatieId;
      } else if (!isAdmin) {
        // Beperk tot eigen organisaties
        where.OR = [
          { organisatieId: { in: organisatieIds } },
          { organisatieId: null, gebruikerId } // Eigen acties zonder organisatie
        ];
      }

      if (filters.van) where.timestamp = { gte: filters.van };
      if (filters.tot) where.timestamp = { ...where.timestamp, lte: filters.tot };

      if (filters.zoekterm) {
        where.OR = [
          { message: { contains: filters.zoekterm, mode: 'insensitive' } },
          { details: { path: ['searchable'], string_contains: filters.zoekterm } }
        ];
      }

      const limit = Math.min(filters.limit || 50, 100);
      const offset = filters.offset || 0;

      const [logs, totaal] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          include: {
            gebruiker: {
              select: {
                id: true,
                email: true,
                voornaam: true,
                achternaam: true
              }
            },
            organisatie: {
              select: {
                id: true,
                naam: true
              }
            }
          },
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset
        }),
        this.prisma.auditLog.count({ where })
      ]);

      const logEntries: LogEntry[] = logs.map(log => ({
        id: log.id,
        level: log.level as LogLevel,
        category: log.category as LogCategory,
        message: log.message,
        details: log.details as Record<string, any>,
        gebruikerId: log.gebruikerId,
        organisatieId: log.organisatieId,
        ipAdres: log.ipAdres,
        userAgent: log.userAgent,
        requestId: log.requestId,
        timestamp: log.timestamp,
        gebruiker: log.gebruiker,
        organisatie: log.organisatie
      }));

      return {
        success: true,
        data: {
          logs: logEntries,
          totaal,
          heeftMeer: totaal > offset + limit
        }
      };

    } catch (error: any) {
      logger.error({ err: error, filters, gebruikerId }, 'Fout bij ophalen audit logs');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het ophalen van logs',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Ruim oude logs op
   */
  async ruimOudeLogs(oudeThanDagen: number = 90): Promise<ServiceResult<{ verwijderd: number }>> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - oudeThanDagen);

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
          level: { not: 'ERROR' } // Bewaar error logs langer
        }
      });

      logger.info({ 
        verwijderdeLogs: result.count,
        cutoffDate,
        oudeThanDagen 
      }, 'Oude audit logs opgeruimd');

      return {
        success: true,
        data: { verwijderd: result.count }
      };

    } catch (error: any) {
      logger.error({ err: error, oudeThanDagen }, 'Fout bij opruimen oude logs');
      
      return {
        success: false,
        error: {
          name: 'InternalError',
          message: 'Er is een fout opgetreden bij het opruimen van logs',
          code: ERROR_CODES.INTERNAL_ERROR,
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
        }
      };
    }
  }

  /**
   * Convenience methods voor verschillende log types
   */

  async logAuthentication(message: string, details: any) {
    return this.log(LogLevel.INFO, LogCategory.AUTHENTICATION, message, details);
  }

  async logAuthorization(message: string, details: any) {
    return this.log(LogLevel.WARN, LogCategory.AUTHORIZATION, message, details);
  }

  async logOrganisationChange(message: string, details: any) {
    return this.log(LogLevel.INFO, LogCategory.ORGANISATION, message, details);
  }

  async logChatbotAction(message: string, details: any) {
    return this.log(LogLevel.INFO, LogCategory.CHATBOT, message, details);
  }

  async logSystemError(message: string, details: any) {
    return this.log(LogLevel.ERROR, LogCategory.SYSTEM, message, details);
  }
}
