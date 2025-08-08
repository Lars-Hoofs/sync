import { z } from 'zod';
import { OrganisatieRol } from '../../shared/types';

/**
 * Schema voor het maken van een nieuwe uitnodiging
 */
export const maakUitnodigingSchema = z.object({
  email: z
    .string({ required_error: 'E-mail is verplicht' })
    .email('Ongeldig e-mailadres')
    .max(255, 'E-mail mag maximaal 255 tekens bevatten')
    .toLowerCase()
    .trim(),
  
  rol: z.nativeEnum(OrganisatieRol, {
    errorMap: () => ({ message: 'Ongeldige rol. Kies uit: EIGENAAR, BEHEERDER, EDITOR, VIEWER' })
  }),

  organisatieId: z
    .string({ required_error: 'Organisatie ID is verplicht' })
    .uuid('Ongeldig organisatie ID formaat'),

  bericht: z
    .string()
    .max(500, 'Bericht mag maximaal 500 tekens bevatten')
    .trim()
    .optional()
});

/**
 * Schema voor het beantwoorden van een uitnodiging
 */
export const beantwoordUitnodigingSchema = z.object({
  accepteer: z
    .boolean({ required_error: 'Accepteer waarde is verplicht' })
    .describe('True om uitnodiging te accepteren, false om af te wijzen')
});

/**
 * Schema voor het bijwerken van een uitnodiging
 */
export const updateUitnodigingSchema = z.object({
  rol: z.nativeEnum(OrganisatieRol, {
    errorMap: () => ({ message: 'Ongeldige rol. Kies uit: EIGENAAR, BEHEERDER, EDITOR, VIEWER' })
  }).optional(),

  bericht: z
    .string()
    .max(500, 'Bericht mag maximaal 500 tekens bevatten')
    .trim()
    .optional()
});

/**
 * Schema voor uitnodiging parameters (URL params)
 */
export const uitnodigingParamsSchema = z.object({
  id: z
    .string({ required_error: 'Uitnodiging ID is verplicht' })
    .uuid('Ongeldig uitnodiging ID formaat')
});

/**
 * Schema voor uitnodiging token parameters
 */
export const uitnodigingTokenParamsSchema = z.object({
  token: z
    .string({ required_error: 'Token is verplicht' })
    .min(1, 'Token mag niet leeg zijn')
});

/**
 * Schema voor organisatie uitnodiging parameters
 */
export const organisatieUitnodigingParamsSchema = z.object({
  organisatieId: z
    .string({ required_error: 'Organisatie ID is verplicht' })
    .uuid('Ongeldig organisatie ID formaat'),
  
  uitnodigingId: z
    .string({ required_error: 'Uitnodiging ID is verplicht' })
    .uuid('Ongeldig uitnodiging ID formaat')
});

/**
 * Schema voor query parameters bij het ophalen van uitnodigingen
 */
export const uitnodigingQuerySchema = z.object({
  status: z
    .enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'])
    .optional(),
  
  organisatieId: z
    .string()
    .uuid('Ongeldig organisatie ID formaat')
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
    .default('0')
});

/**
 * Schema voor publieke uitnodiging informatie (acceptance page)
 */
export const publicUitnodigingInfoSchema = z.object({
  organisatie: z.object({
    naam: z.string(),
    beschrijving: z.string().nullable(),
    logo: z.string().nullable(),
  }),
  uitnodigingGeldig: z.boolean(),
  gebruikerBestaat: z.boolean(),
  rol: z.nativeEnum(OrganisatieRol),
  bericht: z.string().nullable(),
  verlooptOp: z.date(),
  uitnodiger: z.object({
    voornaam: z.string(),
    tussenvoegsel: z.string().nullable(),
    achternaam: z.string(),
  })
});

// JSON Schema versions for Fastify
export const maakUitnodigingJsonSchema = {
  type: 'object',
  required: ['email', 'rol', 'organisatieId'],
  properties: {
    email: { type: 'string', format: 'email', maxLength: 255 },
    rol: { type: 'string', enum: ['EIGENAAR', 'BEHEERDER', 'EDITOR', 'VIEWER'] },
    organisatieId: { type: 'string', format: 'uuid' },
    bericht: { type: 'string', maxLength: 500 }
  },
  additionalProperties: false
};

export const beantwoordUitnodigingJsonSchema = {
  type: 'object',
  required: ['accepteer'],
  properties: {
    accepteer: { type: 'boolean' }
  },
  additionalProperties: false
};

export const updateUitnodigingJsonSchema = {
  type: 'object',
  properties: {
    rol: { type: 'string', enum: ['EIGENAAR', 'BEHEERDER', 'EDITOR', 'VIEWER'] },
    bericht: { type: 'string', maxLength: 500 }
  },
  additionalProperties: false
};

export const uitnodigingParamsJsonSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', format: 'uuid' }
  }
};

export const uitnodigingTokenParamsJsonSchema = {
  type: 'object',
  required: ['token'],
  properties: {
    token: { type: 'string', minLength: 1 }
  }
};

export const organisatieUitnodigingParamsJsonSchema = {
  type: 'object',
  required: ['organisatieId', 'uitnodigingId'],
  properties: {
    organisatieId: { type: 'string', format: 'uuid' },
    uitnodigingId: { type: 'string', format: 'uuid' }
  }
};

export const uitnodigingQueryJsonSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'] },
    organisatieId: { type: 'string', format: 'uuid' },
    limit: { type: 'string', pattern: '^\\d+$', default: '20' },
    offset: { type: 'string', pattern: '^\\d+$', default: '0' }
  }
};

// Export types
export type MaakUitnodigingInput = z.infer<typeof maakUitnodigingSchema>;
export type BeantwoordUitnodigingInput = z.infer<typeof beantwoordUitnodigingSchema>;
export type UpdateUitnodigingInput = z.infer<typeof updateUitnodigingSchema>;
export type UitnodigingQueryInput = z.infer<typeof uitnodigingQuerySchema>;
export type PublicUitnodigingInfo = z.infer<typeof publicUitnodigingInfoSchema>;
