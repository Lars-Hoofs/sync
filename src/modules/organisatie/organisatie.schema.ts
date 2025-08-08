import { z } from 'zod';

// Base organisation schema
export const organisatieBaseSchema = z.object({
  naam: z.string().min(1, 'Organisatie naam is verplicht').max(100, 'Naam mag maximaal 100 karakters lang zijn'),
  domein: z.string().optional().refine(
    (val) => !val || /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](\.[a-zA-Z]{2,})+$/.test(val),
    'Ongeldig domein formaat'
  ),
});

// Create organisation schema
export const maakOrganisatieSchema = organisatieBaseSchema.extend({
  slug: z.string()
    .min(3, 'Slug moet minimaal 3 karakters lang zijn')
    .max(50, 'Slug mag maximaal 50 karakters lang zijn')
    .regex(/^[a-z0-9-]+$/, 'Slug mag alleen lowercase letters, cijfers en streepjes bevatten')
    .optional(),
});

// Update organisation schema
export const updateOrganisatieSchema = organisatieBaseSchema.extend({
  tweeFAVerplicht: z.boolean().optional(),
  maxAantalLeden: z.number().int().positive().optional(),
  sessieTimeoutMinuten: z.number().int().min(5).max(1440).optional(), // 5 minuten tot 24 uur
  ipWhitelist: z.array(z.string().ip()).optional(),
});

// Organisation settings schema
export const organisatieInstellingenSchema = z.object({
  tweeFAVerplicht: z.boolean(),
  maxAantalLeden: z.number().int().positive().nullable(),
  sessieTimeoutMinuten: z.number().int().min(5).max(1440),
  ipWhitelist: z.array(z.string().ip()),
  maxOpslag: z.number().int().positive().nullable(),
  maxApiCalls: z.number().int().positive().nullable(),
  maxProjecten: z.number().int().positive().nullable(),
});

// Response schemas
export const organisatieResponseSchema = z.object({
  id: z.string(),
  naam: z.string(),
  slug: z.string(),
  domein: z.string().nullable(),
  aangemaaktOp: z.date(),
  bijgewerktOp: z.date(),
  tweeFAVerplicht: z.boolean(),
  maxAantalLeden: z.number().nullable(),
  sessieTimeoutMinuten: z.number(),
  eigenaar: z.object({
    id: z.string(),
    voornaam: z.string(),
    tussenvoegsel: z.string().nullable(),
    achternaam: z.string(),
    email: z.string(),
  }),
  abonnementStatus: z.enum(['PROEFPERIODE', 'ACTIEF', 'VERLOPEN', 'GEANNULEERD', 'ONBETAALD']),
  proefperiodeEindigtOp: z.date().nullable(),
});

export const organisatieDetailResponseSchema = organisatieResponseSchema.extend({
  ipWhitelist: z.array(z.string()),
  maxOpslag: z.number().nullable(),
  maxApiCalls: z.number().nullable(),
  maxProjecten: z.number().nullable(),
  dataIsolatieId: z.string(),
  aantalLeden: z.number(),
  aantalChatbots: z.number(),
});

export const organisatieStatistiekenSchema = z.object({
  aantalLeden: z.number(),
  aantalChatbots: z.number(),
  aantalApiCalls: z.number(),
  opslagGebruikt: z.number(),
  recenteActiviteit: z.array(z.object({
    actie: z.string(),
    gebruiker: z.string(),
    timestamp: z.date(),
  })),
});

// Member management schemas
export const organisatieLidSchema = z.object({
  id: z.string(),
  gebruiker: z.object({
    id: z.string(),
    voornaam: z.string(),
    tussenvoegsel: z.string().nullable(),
    achternaam: z.string(),
    email: z.string(),
    laatsteLogin: z.date().nullable(),
  }),
  rol: z.enum(['EIGENAAR', 'BEHEERDER', 'MANAGER', 'LID']),
  aangemaaktOp: z.date(),
  isActief: z.boolean(),
  laatsteActiviteit: z.date().nullable(),
});

export const wijzigLidRolSchema = z.object({
  rol: z.enum(['BEHEERDER', 'MANAGER', 'LID']), // EIGENAAR kan niet gewijzigd worden
});

// Parameter schemas
export const organisatieParamsSchema = z.object({
  id: z.string().uuid('Ongeldig organisatie ID formaat'),
});

export const lidmaatschapParamsSchema = z.object({
  id: z.string().uuid('Ongeldig organisatie ID formaat'),
  lidmaatschapId: z.string().uuid('Ongeldig lidmaatschap ID formaat'),
});

// JSON Schema versions for Fastify
export const maakOrganisatieJsonSchema = {
  type: 'object',
  required: ['naam'],
  properties: {
    naam: { type: 'string', minLength: 1, maxLength: 100 },
    domein: { type: 'string' },
    slug: { type: 'string', minLength: 3, maxLength: 50, pattern: '^[a-z0-9-]+$' }
  },
  additionalProperties: false
};

export const updateOrganisatieJsonSchema = {
  type: 'object',
  properties: {
    naam: { type: 'string', minLength: 1, maxLength: 100 },
    domein: { type: 'string' },
    tweeFAVerplicht: { type: 'boolean' },
    maxAantalLeden: { type: 'integer', minimum: 1 },
    sessieTimeoutMinuten: { type: 'integer', minimum: 5, maximum: 1440 },
    ipWhitelist: { type: 'array', items: { type: 'string' } }
  },
  additionalProperties: false
};

export const wijzigLidRolJsonSchema = {
  type: 'object',
  required: ['rol'],
  properties: {
    rol: { type: 'string', enum: ['BEHEERDER', 'MANAGER', 'LID'] }
  },
  additionalProperties: false
};

export const organisatieParamsJsonSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', format: 'uuid' }
  }
};

export const lidmaatschapParamsJsonSchema = {
  type: 'object',
  required: ['id', 'lidmaatschapId'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    lidmaatschapId: { type: 'string', format: 'uuid' }
  }
};

// Export types
export type OrganisatieBase = z.infer<typeof organisatieBaseSchema>;
export type MaakOrganisatie = z.infer<typeof maakOrganisatieSchema>;
export type UpdateOrganisatie = z.infer<typeof updateOrganisatieSchema>;
export type OrganisatieInstellingen = z.infer<typeof organisatieInstellingenSchema>;
export type OrganisatieResponse = z.infer<typeof organisatieResponseSchema>;
export type OrganisatieDetailResponse = z.infer<typeof organisatieDetailResponseSchema>;
export type OrganisatieStatistieken = z.infer<typeof organisatieStatistiekenSchema>;
export type OrganisatieLid = z.infer<typeof organisatieLidSchema>;
export type WijzigLidRol = z.infer<typeof wijzigLidRolSchema>;
