import { z } from 'zod';
import { SessieStatus, DeviceType } from './sessie.types.js';

/**
 * Schema voor sessie parameters (URL params)
 */
export const sessieParamsSchema = z.object({
  id: z
    .string({ required_error: 'Sessie ID is verplicht' })
    .uuid('Ongeldig sessie ID formaat')
});

/**
 * Schema voor het beëindigen van een sessie
 */
export const beeindigSessieSchema = z.object({
  reden: z
    .string()
    .max(200, 'Reden mag maximaal 200 tekens bevatten')
    .optional()
});

/**
 * Schema voor sessie query parameters
 */
export const sessieQuerySchema = z.object({
  status: z
    .nativeEnum(SessieStatus)
    .optional(),

  deviceType: z
    .nativeEnum(DeviceType)
    .optional(),

  limit: z
    .string()
    .regex(/^\d+$/, 'Limit moet een getal zijn')
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0 && val <= 100, 'Limit moet tussen 1 en 100 zijn')
    .optional()
    .default('20'),

  offset: z
    .string()
    .regex(/^\d+$/, 'Offset moet een getal zijn')
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 0, 'Offset moet 0 of hoger zijn')
    .optional()
    .default('0'),

  vanaf: z
    .string()
    .datetime('Ongeldige datum formaat')
    .transform(val => new Date(val))
    .optional(),

  tot: z
    .string()
    .datetime('Ongeldige datum formaat')
    .transform(val => new Date(val))
    .optional()
});

/**
 * Schema voor device informatie
 */
export const deviceInfoSchema = z.object({
  type: z.nativeEnum(DeviceType).default(DeviceType.UNKNOWN),
  browser: z.string().max(50).optional(),
  os: z.string().max(50).optional(),
  isMobile: z.boolean().default(false)
});

/**
 * Schema voor IP adres validatie
 */
export const ipAdresSchema = z
  .string()
  .refine(
    (val) => {
      // Simpele IPv4/IPv6 validatie
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
      return ipv4Regex.test(val) || ipv6Regex.test(val);
    },
    'Ongeldig IP adres formaat'
  );

/**
 * Schema voor bulk sessie acties
 */
export const bulkSessieActieSchema = z.object({
  sessieIds: z
    .array(z.string().uuid('Ongeldig sessie ID'))
    .min(1, 'Minimaal één sessie ID vereist')
    .max(50, 'Maximaal 50 sessies per actie'),

  actie: z.enum(['BEEINDIGEN', 'BLOKKEREN', 'ACTIVEREN'], {
    errorMap: () => ({ message: 'Ongeldige actie. Kies uit: BEEINDIGEN, BLOKKEREN, ACTIVEREN' })
  }),

  reden: z
    .string()
    .max(200, 'Reden mag maximaal 200 tekens bevatten')
    .optional()
});

/**
 * Schema voor sessie statistieken filters
 */
export const sessieStatistiekenSchema = z.object({
  periode: z.enum(['DAG', 'WEEK', 'MAAND', 'JAAR']).default('WEEK'),
  
  groupBy: z
    .array(z.enum(['device', 'browser', 'os', 'datum']))
    .optional(),

  includeInactiefSessies: z
    .boolean()
    .default(false)
});

// Export types
export type SessieQueryInput = z.infer<typeof sessieQuerySchema>;
export type DeviceInfoInput = z.infer<typeof deviceInfoSchema>;
export type BulkSessieActieInput = z.infer<typeof bulkSessieActieSchema>;
export type SessieStatistiekenInput = z.infer<typeof sessieStatistiekenSchema>;
