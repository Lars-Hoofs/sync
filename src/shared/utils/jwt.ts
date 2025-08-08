import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '../../config/env.js';
import { createLogger } from './logger.js';

const logger = createLogger('JWTService');

export interface SessionPayload extends JWTPayload {
  userId: string;
  sessionId?: string;
  organisatieId?: string;
  iat?: number;
  exp?: number;
}

/**
 * Genereer een JWT token voor een gebruiker
 */
export async function generateAccessToken(
  userId: string, 
  sessionId?: string, 
  organisatieId?: string
): Promise<string> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    
    const payload: SessionPayload = {
      userId,
      sessionId,
      organisatieId,
    };

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .setIssuer(env.JWT_ISSUER || 'sync-api')
      .setAudience(env.JWT_AUDIENCE || 'sync-client')
      .sign(secret);

    return token;

  } catch (error) {
    logger.error({ err: error, userId }, 'Fout bij genereren JWT token');
    throw new Error('Token generatie gefaald');
  }
}

/**
 * Verifieer een JWT token
 */
export async function verifyAccessToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    
    const { payload } = await jwtVerify(token, secret, {
      issuer: env.JWT_ISSUER || 'sync-api',
      audience: env.JWT_AUDIENCE || 'sync-client',
    });

    return payload as SessionPayload;

  } catch (error) {
    logger.debug({ err: error }, 'JWT verificatie gefaald');
    return null;
  }
}

/**
 * Genereer een refresh token (langere levensduur)
 */
export async function generateRefreshToken(userId: string): Promise<string> {
  try {
    const secret = new TextEncoder().encode(env.JWT_REFRESH_SECRET || env.JWT_SECRET);
    
    const payload = {
      userId,
      type: 'refresh'
    };

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d') // 7 dagen
      .setIssuer(env.JWT_ISSUER || 'sync-api')
      .setAudience(env.JWT_AUDIENCE || 'sync-client')
      .sign(secret);

    return token;

  } catch (error) {
    logger.error({ err: error, userId }, 'Fout bij genereren refresh token');
    throw new Error('Refresh token generatie gefaald');
  }
}

/**
 * Verifieer een refresh token
 */
export async function verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_REFRESH_SECRET || env.JWT_SECRET);
    
    const { payload } = await jwtVerify(token, secret, {
      issuer: env.JWT_ISSUER || 'sync-api',
      audience: env.JWT_AUDIENCE || 'sync-client',
    });

    if (payload.type !== 'refresh') {
      return null;
    }

    return { userId: payload.userId as string };

  } catch (error) {
    logger.debug({ err: error }, 'Refresh token verificatie gefaald');
    return null;
  }
}

/**
 * Extraheer token uit Authorization header
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7);
}

/**
 * Decode JWT payload zonder verificatie (voor debugging)
 */
export function decodeTokenPayload(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    return payload;
  } catch (error) {
    return null;
  }
}
