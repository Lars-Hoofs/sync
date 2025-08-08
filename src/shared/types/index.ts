import { FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
  
  interface FastifyRequest {
    user?: AuthenticatedUser;
    organisatie?: OrganisatieContext;
    requestId: string;
  }
}

// Authentication types
export interface AuthenticatedUser {
  id: string;
  email: string;
  voornaam: string;
  achternaam: string;
  tussenvoegsel?: string;
  isActief: boolean;
  emailGeverifieerd: boolean;
  tweeFAIngeschakeld: boolean;
}

export interface OrganisatieContext {
  id: string;
  naam: string;
  slug: string;
  rol: OrganisatieRol;
  rechten: string[];
}

export interface SessionPayload {
  userId: string;
  sessionId: string;
  organisatieId?: string;
  iat: number;
  exp: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
  meta?: PaginationMeta;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

// Database enum types (matching Prisma schema)
export enum OrganisatieRol {
  EIGENAAR = 'EIGENAAR',
  BEHEERDER = 'BEHEERDER',
  MANAGER = 'MANAGER',
  LID = 'LID'
}

export enum AbonnementStatus {
  PROEFPERIODE = 'PROEFPERIODE',
  ACTIEF = 'ACTIEF',
  VERLOPEN = 'VERLOPEN',
  GEANNULEERD = 'GEANNULEERD',
  ONBETAALD = 'ONBETAALD'
}

export enum UitnodigingStatus {
  IN_BEHANDELING = 'IN_BEHANDELING',
  GEACCEPTEERD = 'GEACCEPTEERD',
  VERLOPEN = 'VERLOPEN',
  INGETROKKEN = 'INGETROKKEN'
}

export enum TweeFAType {
  TOTP = 'TOTP',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  BACKUP_CODE = 'BACKUP_CODE'
}

export enum DataGevoeligheidsNiveau {
  OPENBAAR = 'OPENBAAR',
  INTERN = 'INTERN',
  VERTROUWELIJK = 'VERTROUWELIJK',
  STRIKT_VERTROUWELIJK = 'STRIKT_VERTROUWELIJK'
}

export enum FactuurStatus {
  CONCEPT = 'CONCEPT',
  VERZONDEN = 'VERZONDEN',
  BETAALD = 'BETAALD',
  ACHTERSTALLIG = 'ACHTERSTALLIG',
  GEANNULEERD = 'GEANNULEERD'
}

export enum DataBronType {
  PDF = 'PDF',
  CSV = 'CSV',
  TXT = 'TXT',
  WEBSITE = 'WEBSITE',
  BESTAND = 'BESTAND'
}

export enum CrawlStatus {
  IN_WACHT = 'IN_WACHT',
  BEZIG = 'BEZIG',
  KLAAR = 'KLAAR',
  MISLUKT = 'MISLUKT'
}

// Utility types
export interface RequestContext {
  requestId: string;
  userId?: string;
  organisatieId?: string;
  ipAddress?: string;
  userAgent?: string;
  startTime: number;
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  organisatieId?: string;
  action?: string;
  resource?: string;
  ipAddress?: string;
}

// Error types
export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: CustomError;
}

// File upload types
export interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  data: Buffer;
}

// Email types
export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  variables?: Record<string, any>;
}

// Notification types
export interface NotificationPayload {
  userId: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

// Audit log types
export interface AuditLogEntry {
  actie: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}
