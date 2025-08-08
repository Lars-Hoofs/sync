import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import { authenticator } from 'otplib';
import { env } from '../../config/env.js';
import { TOTP_CONFIG } from '../../config/constants.js';

/**
 * Hash een wachtwoord met Argon2
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
      secret: Buffer.from(env.ARGON2_SECRET, 'utf-8'),
    });
    return hash;
  } catch (error) {
    throw new Error('Fout bij het hashen van het wachtwoord');
  }
}

/**
 * Verifieer een wachtwoord tegen een hash
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password, {
      secret: Buffer.from(env.ARGON2_SECRET, 'utf-8'),
    });
  } catch (error) {
    return false;
  }
}

/**
 * Alias voor verifyPassword voor backward compatibility
 */
export const comparePassword = verifyPassword;

/**
 * Genereer een veilige random token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Genereer een UUID
 */
export function generateUUID(): string {
  return randomUUID();
}

/**
 * Genereer een numerieke code (voor SMS/Email 2FA)
 */
export function generateNumericCode(length: number = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

/**
 * Genereer een TOTP secret voor 2FA
 */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Genereer een TOTP URI voor QR code
 */
export function generateTOTPUri(secret: string, email: string, issuer: string = env.TOTP_ISSUER): string {
  return authenticator.keyuri(email, issuer, secret);
}

/**
 * Verifieer een TOTP token
 */
export function verifyTOTP(token: string, secret: string): boolean {
  authenticator.options = {
    window: env.TOTP_WINDOW,
    step: TOTP_CONFIG.PERIOD,
  };
  
  return authenticator.verify({
    token,
    secret,
  });
}

/**
 * Genereer backup codes voor 2FA
 */
export function generateBackupCodes(count: number = TOTP_CONFIG.BACKUP_CODES_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(generateSecureToken(TOTP_CONFIG.BACKUP_CODE_LENGTH).toUpperCase());
  }
  return codes;
}

/**
 * Hash een backup code (voor opslag in database)
 */
export async function hashBackupCode(code: string): Promise<string> {
  return await hashPassword(code);
}

/**
 * Verifieer een backup code
 */
export async function verifyBackupCode(code: string, hashedCodes: string[]): Promise<{ isValid: boolean; index: number }> {
  for (let i = 0; i < hashedCodes.length; i++) {
    const isValid = await verifyPassword(hashedCodes[i], code);
    if (isValid) {
      return { isValid: true, index: i };
    }
  }
  return { isValid: false, index: -1 };
}

/**
 * Genereer een slug van een string (voor organisatie slugs)
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Verwijder speciale karakters
    .replace(/[\s_-]+/g, '-') // Vervang spaties en underscores met streepjes
    .replace(/^-+|-+$/g, ''); // Verwijder streepjes aan begin en eind
}

/**
 * Genereer een unieke slug met suffix indien nodig
 */
export function generateUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let slug = generateSlug(baseSlug);
  let counter = 1;
  
  while (existingSlugs.includes(slug)) {
    slug = `${generateSlug(baseSlug)}-${counter}`;
    counter++;
  }
  
  return slug;
}
