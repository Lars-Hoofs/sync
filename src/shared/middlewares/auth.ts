import { FastifyRequest, FastifyReply } from 'fastify';
import { jwtVerify } from 'jose';
import { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import { createLogger } from '../utils/logger.js';
import type { 
  AuthenticatedUser, 
  OrganisatieContext, 
  SessionPayload,
  OrganisatieRol
} from '../types/index.js';

const logger = createLogger('AuthMiddleware');

/**
 * JWT Token verification utility
 */
async function verifyJwtToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch (error) {
    logger.debug({ err: error }, 'JWT verificatie gefaald');
    return null;
  }
}

/**
 * Session cookie verification utility
 */
async function verifySessionCookie(sessionId: string, prisma: PrismaClient): Promise<SessionPayload | null> {
  try {
    const sessie = await prisma.sessie.findUnique({
      where: { 
        id: sessionId,
        status: 'ACTIEF',
        verlooptOp: { gt: new Date() }
      },
      include: {
        gebruiker: {
          select: {
            id: true,
            isActief: true,
            isGeblokkeerd: true,
          }
        }
      }
    });

    if (!sessie || !sessie.gebruiker.isActief || sessie.gebruiker.isGeblokkeerd) {
      return null;
    }

    // Update laatste activiteit
    await prisma.sessie.update({
      where: { id: sessie.id },
      data: { laatsteActiviteit: new Date() }
    });

    return {
      userId: sessie.gebruikerId,
      sessionId: sessie.id,
      iat: Math.floor(sessie.aangemaaktOp.getTime() / 1000),
      exp: Math.floor(sessie.verlooptOp.getTime() / 1000),
    };
  } catch (error) {
    logger.error({ err: error }, 'Sessie verificatie gefaald');
    return null;
  }
}

/**
 * Load user information
 */
async function loadUser(userId: string, prisma: PrismaClient): Promise<AuthenticatedUser | null> {
  try {
    const gebruiker = await prisma.gebruiker.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        voornaam: true,
        tussenvoegsel: true,
        achternaam: true,
        isActief: true,
        emailGeverifieerd: true,
        tweeFAIngeschakeld: true,
      }
    });

    return gebruiker;
  } catch (error) {
    logger.error({ err: error, userId }, 'Fout bij laden gebruiker');
    return null;
  }
}

/**
 * Load organization context for user
 */
async function loadOrganisatieContext(
  userId: string, 
  organisatieId: string, 
  prisma: PrismaClient
): Promise<OrganisatieContext | null> {
  try {
    const lidmaatschap = await prisma.organisatieLidmaatschap.findUnique({
      where: {
        gebruikerId_organisatieId: {
          gebruikerId: userId,
          organisatieId: organisatieId
        },
        isActief: true
      },
      include: {
        organisatie: {
          select: {
            id: true,
            naam: true,
            slug: true,
          }
        },
        rechten: {
          include: {
            recht: {
              select: {
                naam: true
              }
            }
          },
          where: {
            toegekend: true
          }
        }
      }
    });

    if (!lidmaatschap) {
      return null;
    }

    const rechten = lidmaatschap.rechten.map(r => r.recht.naam);

    return {
      id: lidmaatschap.organisatie.id,
      naam: lidmaatschap.organisatie.naam,
      slug: lidmaatschap.organisatie.slug,
      rol: lidmaatschap.rol as OrganisatieRol,
      rechten,
    };
  } catch (error) {
    logger.error({ err: error, userId, organisatieId }, 'Fout bij laden organisatie context');
    return null;
  }
}

/**
 * Authentication middleware
 * Verifies JWT token or session cookie and loads user
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const prisma = (request.server as any).prisma as PrismaClient;
  
  // Check for Bearer token
  const authorization = request.headers.authorization;
  let sessionPayload: SessionPayload | null = null;

  if (authorization && authorization.startsWith('Bearer ')) {
    const token = authorization.substring(7);
    sessionPayload = await verifyJwtToken(token);
  }

  // Check for session cookie if no Bearer token
  if (!sessionPayload && request.cookies.session) {
    sessionPayload = await verifySessionCookie(request.cookies.session, prisma);
  }

  if (!sessionPayload) {
    return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
      success: false,
      message: 'Authenticatie vereist',
      errors: [{
        field: 'auth',
        message: 'Geen geldige sessie gevonden',
        code: ERROR_CODES.INVALID_CREDENTIALS
      }]
    });
  }

  // Load user information
  const user = await loadUser(sessionPayload.userId, prisma);
  if (!user || !user.isActief) {
    return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
      success: false,
      message: 'Gebruiker account niet actief',
      errors: [{
        field: 'auth',
        message: 'Account gedeactiveerd',
        code: ERROR_CODES.ACCOUNT_LOCKED
      }]
    });
  }

  // Add user to request
  (request as any).user = user;

  // Load organization context if specified
  if (sessionPayload.organisatieId) {
    const organisatieContext = await loadOrganisatieContext(
      user.id, 
      sessionPayload.organisatieId, 
      prisma
    );
    
    if (organisatieContext) {
      (request as any).organisatie = organisatieContext;
    }
  }
}

/**
 * Optional authentication middleware
 * Same as authenticate but doesn't fail if no auth is provided
 */
export async function optionalAuthenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await authenticate(request, reply);
  } catch (error) {
    // Silently ignore authentication failures
    logger.debug('Optional authentication failed, continuing without user');
  }
}

/**
 * Require specific organization membership
 */
export function requireOrganisation(organisatieSlug?: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const organisatie = (request as any).organisatie as OrganisatieContext | undefined;
    
    if (!organisatie) {
      return reply.code(HTTP_STATUS.FORBIDDEN).send({
        success: false,
        message: 'Organisatie context vereist',
        errors: [{
          field: 'organisation',
          message: 'Geen organisatie geselecteerd',
          code: ERROR_CODES.USER_NOT_MEMBER
        }]
      });
    }

    if (organisatieSlug && organisatie.slug !== organisatieSlug) {
      return reply.code(HTTP_STATUS.FORBIDDEN).send({
        success: false,
        message: 'Toegang tot deze organisatie geweigerd',
        errors: [{
          field: 'organisation',
          message: 'Onvoldoende rechten voor deze organisatie',
          code: ERROR_CODES.INSUFFICIENT_PERMISSIONS
        }]
      });
    }
  };
}

/**
 * Require specific permission
 */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const organisatie = (request as any).organisatie as OrganisatieContext | undefined;
    
    if (!organisatie) {
      return reply.code(HTTP_STATUS.FORBIDDEN).send({
        success: false,
        message: 'Organisatie context vereist voor deze actie'
      });
    }

    if (!organisatie.rechten.includes(permission)) {
      return reply.code(HTTP_STATUS.FORBIDDEN).send({
        success: false,
        message: 'Onvoldoende rechten voor deze actie',
        errors: [{
          field: 'permission',
          message: `Recht '${permission}' vereist`,
          code: ERROR_CODES.INSUFFICIENT_PERMISSIONS
        }]
      });
    }
  };
}

/**
 * Require specific role
 */
export function requireRole(minimumRole: 'EIGENAAR' | 'BEHEERDER' | 'MANAGER' | 'LID') {
  const roleHierarchy = ['LID', 'MANAGER', 'BEHEERDER', 'EIGENAAR'];
  const requiredLevel = roleHierarchy.indexOf(minimumRole);

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const organisatie = (request as any).organisatie as OrganisatieContext | undefined;
    
    if (!organisatie) {
      return reply.code(HTTP_STATUS.FORBIDDEN).send({
        success: false,
        message: 'Organisatie context vereist voor deze actie'
      });
    }

    const userLevel = roleHierarchy.indexOf(organisatie.rol);
    if (userLevel < requiredLevel) {
      return reply.code(HTTP_STATUS.FORBIDDEN).send({
        success: false,
        message: 'Onvoldoende rechten voor deze actie',
        errors: [{
          field: 'role',
          message: `Minimaal ${minimumRole} rol vereist`,
          code: ERROR_CODES.INSUFFICIENT_PERMISSIONS
        }]
      });
    }
  };
}
