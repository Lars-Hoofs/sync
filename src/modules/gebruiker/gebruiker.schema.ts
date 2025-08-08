import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PASSWORD_RULES } from '../../config/constants.js';

// Base user schema
export const gebruikerBaseSchema = z.object({
  email: z.string().email('Ongeldig email adres'),
  voornaam: z.string().min(1, 'Voornaam is verplicht'),
  tussenvoegsel: z.string().optional(),
  achternaam: z.string().min(1, 'Achternaam is verplicht'),
});

// Password validation schema
export const passwordSchema = z.string()
  .min(PASSWORD_RULES.MIN_LENGTH, `Wachtwoord moet minimaal ${PASSWORD_RULES.MIN_LENGTH} karakters lang zijn`)
  .regex(/[A-Z]/, 'Wachtwoord moet minimaal één hoofdletter bevatten')
  .regex(/[a-z]/, 'Wachtwoord moet minimaal één kleine letter bevatten')
  .regex(/[0-9]/, 'Wachtwoord moet minimaal één cijfer bevatten')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Wachtwoord moet minimaal één speciaal karakter bevatten');

// Registration schemas
export const registratieSchema = gebruikerBaseSchema.extend({
  wachtwoord: passwordSchema,
  wachtwoordBevestiging: z.string(),
}).refine((data) => data.wachtwoord === data.wachtwoordBevestiging, {
  message: 'Wachtwoorden komen niet overeen',
  path: ['wachtwoordBevestiging'],
});

// Login schemas
export const loginSchema = z.object({
  email: z.string().email('Ongeldig email adres'),
  wachtwoord: z.string().min(1, 'Wachtwoord is verplicht'),
  tweeFACode: z.string().optional(),
  onthoudenLogin: z.boolean().optional().default(false),
});

// Update profile schemas
export const updateProfielSchema = gebruikerBaseSchema.partial().omit({ email: true });

// Change password schemas
export const wijzigWachtwoordSchema = z.object({
  huidigWachtwoord: z.string().min(1, 'Huidig wachtwoord is verplicht'),
  nieuwWachtwoord: passwordSchema,
  nieuwWachtwoordBevestiging: z.string(),
}).refine((data) => data.nieuwWachtwoord === data.nieuwWachtwoordBevestiging, {
  message: 'Nieuwe wachtwoorden komen niet overeen',
  path: ['nieuwWachtwoordBevestiging'],
});

// Email verification schemas
export const emailVerificatieSchema = z.object({
  token: z.string().min(1, 'Verificatie token is verplicht'),
});

// Password reset schemas
export const wachtwoordResetAanvraagSchema = z.object({
  email: z.string().email('Ongeldig email adres'),
});

export const wachtwoordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is verplicht'),
  nieuwWachtwoord: passwordSchema,
  nieuwWachtwoordBevestiging: z.string(),
}).refine((data) => data.nieuwWachtwoord === data.nieuwWachtwoordBevestiging, {
  message: 'Wachtwoorden komen niet overeen',
  path: ['nieuwWachtwoordBevestiging'],
});

// Response schemas
export const gebruikerResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  voornaam: z.string(),
  tussenvoegsel: z.string().nullable(),
  achternaam: z.string(),
  isActief: z.boolean(),
  emailGeverifieerd: z.boolean(),
  tweeFAIngeschakeld: z.boolean(),
  aangemaaktOp: z.date(),
  bijgewerktOp: z.date(),
  laatsteLogin: z.date().nullable(),
});

export const loginResponseSchema = z.object({
  user: gebruikerResponseSchema,
  requiresTwoFA: z.boolean(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  sessionId: z.string().optional(),
  message: z.string().optional(),
});

// Manual JSON Schema definitions for Fastify
export const registratieJsonSchema = {
  type: 'object',
  required: ['email', 'voornaam', 'achternaam', 'wachtwoord', 'wachtwoordBevestiging'],
  properties: {
    email: { type: 'string', format: 'email' },
    voornaam: { type: 'string', minLength: 1 },
    tussenvoegsel: { type: 'string' },
    achternaam: { type: 'string', minLength: 1 },
    wachtwoord: { type: 'string', minLength: 8 },
    wachtwoordBevestiging: { type: 'string' }
  },
  additionalProperties: false
};

export const loginJsonSchema = {
  type: 'object',
  required: ['email', 'wachtwoord'],
  properties: {
    email: { type: 'string', format: 'email' },
    wachtwoord: { type: 'string', minLength: 1 },
    tweeFACode: { type: 'string' },
    onthoudenLogin: { type: 'boolean', default: false }
  },
  additionalProperties: false
};

export const updateProfielJsonSchema = {
  type: 'object',
  properties: {
    voornaam: { type: 'string', minLength: 1 },
    tussenvoegsel: { type: 'string' },
    achternaam: { type: 'string', minLength: 1 }
  },
  additionalProperties: false
};

export const wijzigWachtwoordJsonSchema = {
  type: 'object',
  required: ['huidigWachtwoord', 'nieuwWachtwoord', 'nieuwWachtwoordBevestiging'],
  properties: {
    huidigWachtwoord: { type: 'string', minLength: 1 },
    nieuwWachtwoord: { type: 'string', minLength: 8 },
    nieuwWachtwoordBevestiging: { type: 'string' }
  },
  additionalProperties: false
};

export const emailVerificatieJsonSchema = {
  type: 'object',
  required: ['token'],
  properties: {
    token: { type: 'string', minLength: 1 }
  },
  additionalProperties: false
};

export const wachtwoordResetAanvraagJsonSchema = {
  type: 'object',
  required: ['email'],
  properties: {
    email: { type: 'string', format: 'email' }
  },
  additionalProperties: false
};

export const wachtwoordResetJsonSchema = {
  type: 'object',
  required: ['token', 'nieuwWachtwoord', 'nieuwWachtwoordBevestiging'],
  properties: {
    token: { type: 'string', minLength: 1 },
    nieuwWachtwoord: { type: 'string', minLength: 8 },
    nieuwWachtwoordBevestiging: { type: 'string' }
  },
  additionalProperties: false
};

export const gebruikerResponseJsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    voornaam: { type: 'string' },
    tussenvoegsel: { type: ['string', 'null'] },
    achternaam: { type: 'string' },
    isActief: { type: 'boolean' },
    emailGeverifieerd: { type: 'boolean' },
    tweeFAIngeschakeld: { type: 'boolean' },
    aangemaaktOp: { type: 'string', format: 'date-time' },
    bijgewerktOp: { type: 'string', format: 'date-time' },
    laatsteLogin: { type: ['string', 'null'], format: 'date-time' }
  }
};

export const loginResponseJsonSchema = {
  type: 'object',
  properties: {
    user: gebruikerResponseJsonSchema,
    requiresTwoFA: { type: 'boolean' },
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
    sessionId: { type: 'string' },
    message: { type: 'string' }
  }
};

// Export types
export type GebruikerBase = z.infer<typeof gebruikerBaseSchema>;
export type Registratie = z.infer<typeof registratieSchema>;
export type Login = z.infer<typeof loginSchema>;
export type UpdateProfiel = z.infer<typeof updateProfielSchema>;
export type WijzigWachtwoord = z.infer<typeof wijzigWachtwoordSchema>;
export type EmailVerificatie = z.infer<typeof emailVerificatieSchema>;
export type WachtwoordResetAanvraag = z.infer<typeof wachtwoordResetAanvraagSchema>;
export type WachtwoordReset = z.infer<typeof wachtwoordResetSchema>;
export type GebruikerResponse = z.infer<typeof gebruikerResponseSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
