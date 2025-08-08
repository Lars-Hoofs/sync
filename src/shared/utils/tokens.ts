import { randomBytes, createHash } from 'crypto';

/**
 * Genereer een veilige random token
 * @param length - Lengte van de token in bytes (standaard 32)
 * @returns Hex string token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Genereer een korte, veilige token (bijvoorbeeld voor uitnodigingen)
 * @param length - Lengte van de token in bytes (standaard 20)
 * @returns URL-safe base64 string
 */
export function generateShortToken(length: number = 20): string {
  return randomBytes(length).toString('base64url');
}

/**
 * Hash een token met SHA-256
 * @param token - De token om te hashen
 * @returns Gehashte token als hex string
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Genereer een verificatie code (numeriek)
 * @param length - Aantal cijfers (standaard 6)
 * @returns Numerieke string
 */
export function generateVerificationCode(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

/**
 * Genereer een API key
 * @returns API key in formaat: sk_live_xxxxxxxxxxxx
 */
export function generateApiKey(): string {
  const prefix = 'sk_live_';
  const key = generateSecureToken(16);
  return prefix + key;
}

/**
 * Valideer of een token het juiste formaat heeft
 * @param token - De token om te valideren
 * @returns Boolean of de token geldig is
 */
export function validateTokenFormat(token: string): boolean {
  // Controleer of het een geldige hex string is van minimaal 32 karakters
  return /^[a-f0-9]{32,}$/.test(token);
}

/**
 * Genereer een JWT secret
 * @returns Random hex string van 64 bytes
 */
export function generateJwtSecret(): string {
  return generateSecureToken(64);
}
