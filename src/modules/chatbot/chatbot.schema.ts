import { z } from 'zod';

// Base chatbot schema
export const chatbotBaseSchema = z.object({
  botNaam: z.string().min(1, 'Bot naam is verplicht').max(50, 'Bot naam mag maximaal 50 karakters lang zijn'),
  widgetNaam: z.string().min(1, 'Widget naam is verplicht').max(50, 'Widget naam mag maximaal 50 karakters lang zijn'),
  websiteUrl: z.string().url('Ongeldige website URL').optional(),
  klantenServiceEmail: z.string().email('Ongeldig email adres').optional(),
});

// Create chatbot schema
export const maakChatbotSchema = chatbotBaseSchema.extend({
  basisPrompt: z.string().min(10, 'Basis prompt moet minimaal 10 karakters lang zijn').max(1000, 'Basis prompt mag maximaal 1000 karakters lang zijn'),
  toon: z.string().min(1, 'Toon is verplicht').max(100, 'Toon mag maximaal 100 karakters lang zijn'),
  startBericht: z.string().min(1, 'Start bericht is verplicht').max(200, 'Start bericht mag maximaal 200 karakters lang zijn'),
});

// Update chatbot schema
export const updateChatbotSchema = chatbotBaseSchema.extend({
  basisPrompt: z.string().min(10).max(1000).optional(),
  toon: z.string().min(1).max(100).optional(),
  startBericht: z.string().min(1).max(200).optional(),
});

// Widget styling schema
export const widgetStylingSchema = z.object({
  mainKleur: z.string().regex(/^#[0-9A-F]{6}$/i, 'Ongeldige hex kleur code'),
  secundaireKleur: z.string().regex(/^#[0-9A-F]{6}$/i, 'Ongeldige hex kleur code').optional(),
  achtergrondKleur: z.string().regex(/^#[0-9A-F]{6}$/i, 'Ongeldige hex kleur code').optional(),
  tekstKleur: z.string().regex(/^#[0-9A-F]{6}$/i, 'Ongeldige hex kleur code').optional(),
  knopKleur: z.string().regex(/^#[0-9A-F]{6}$/i, 'Ongeldige hex kleur code').optional(),
  knopTekstKleur: z.string().regex(/^#[0-9A-F]{6}$/i, 'Ongeldige hex kleur code').optional(),
  knopHoverKleur: z.string().regex(/^#[0-9A-F]{6}$/i, 'Ongeldige hex kleur code').optional(),
  knopHoverTekstKleur: z.string().regex(/^#[0-9A-F]{6}$/i, 'Ongeldige hex kleur code').optional(),
  fontGrootte: z.number().int().min(10).max(24).optional(),
  fontFamilie: z.string().max(100).optional(),
});

// Data source schemas
export const databronSchema = z.object({
  type: z.enum(['PDF', 'CSV', 'TXT', 'WEBSITE', 'BESTAND']),
  bestandsUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
}).refine((data) => {
  if (data.type === 'WEBSITE') {
    return !!data.websiteUrl;
  }
  if (['PDF', 'CSV', 'TXT', 'BESTAND'].includes(data.type)) {
    return !!data.bestandsUrl;
  }
  return true;
}, 'URL is verplicht voor het gekozen type');

export const websiteCrawlSchema = z.object({
  startUrl: z.string().url('Ongeldige start URL'),
  siteMapUrl: z.string().url('Ongeldige sitemap URL').optional(),
  diepte: z.number().int().min(1).max(10).default(3),
});

// Response schemas
export const chatbotResponseSchema = z.object({
  id: z.string(),
  botNaam: z.string(),
  widgetNaam: z.string(),
  websiteUrl: z.string().nullable(),
  klantenServiceEmail: z.string().nullable(),
  basisPrompt: z.string(),
  toon: z.string(),
  startBericht: z.string(),
  mainKleur: z.string(),
  secundaireKleur: z.string().nullable(),
  achtergrondKleur: z.string().nullable(),
  tekstKleur: z.string().nullable(),
  knopKleur: z.string().nullable(),
  knopTekstKleur: z.string().nullable(),
  knopHoverKleur: z.string().nullable(),
  knopHoverTekstKleur: z.string().nullable(),
  fontGrootte: z.number(),
  fontFamilie: z.string(),
  aangemaaktOp: z.date(),
  bijgewerktOp: z.date(),
});

export const chatbotDetailResponseSchema = chatbotResponseSchema.extend({
  databronnen: z.array(z.object({
    id: z.string(),
    type: z.enum(['PDF', 'CSV', 'TXT', 'WEBSITE', 'BESTAND']),
    bestandsUrl: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    teksten: z.array(z.object({
      id: z.string(),
      onderwerp: z.string(),
      aangemaaktOp: z.date(),
    })),
  })),
  crawls: z.array(z.object({
    id: z.string(),
    startUrl: z.string(),
    status: z.enum(['IN_WACHT', 'BEZIG', 'KLAAR', 'MISLUKT']),
    aangemaaktOp: z.date(),
    paginaAantal: z.number().nullable(),
  })),
});

export const chatbotStatistiekenSchema = z.object({
  aantalConversaties: z.number(),
  aantalBerichten: z.number(),
  gemiddeldeTevredenheid: z.number(),
  recenteConversaties: z.array(z.object({
    id: z.string(),
    gestartOp: z.date(),
    aantalBerichten: z.number(),
    status: z.string(),
  })),
});

// Widget embed schema
export const widgetEmbedSchema = z.object({
  widgetUrl: z.string().url(),
  embedCode: z.string(),
  jsCode: z.string(),
  cssCode: z.string(),
});

// JSON Schemas for API validation
export const maakChatbotJsonSchema = {
  type: 'object',
  required: ['botNaam', 'widgetNaam', 'basisPrompt', 'toon', 'startBericht'],
  properties: {
    botNaam: { type: 'string', minLength: 1, maxLength: 50 },
    widgetNaam: { type: 'string', minLength: 1, maxLength: 50 },
    websiteUrl: { type: 'string', format: 'uri' },
    klantenServiceEmail: { type: 'string', format: 'email' },
    basisPrompt: { type: 'string', minLength: 10, maxLength: 1000 },
    toon: { type: 'string', minLength: 1, maxLength: 100 },
    startBericht: { type: 'string', minLength: 1, maxLength: 200 }
  }
};

export const updateChatbotJsonSchema = {
  type: 'object',
  properties: {
    botNaam: { type: 'string', minLength: 1, maxLength: 50 },
    widgetNaam: { type: 'string', minLength: 1, maxLength: 50 },
    websiteUrl: { type: 'string', format: 'uri' },
    klantenServiceEmail: { type: 'string', format: 'email' },
    basisPrompt: { type: 'string', minLength: 10, maxLength: 1000 },
    toon: { type: 'string', minLength: 1, maxLength: 100 },
    startBericht: { type: 'string', minLength: 1, maxLength: 200 }
  }
};

export const chatbotDetailJsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    botNaam: { type: 'string' },
    widgetNaam: { type: 'string' },
    status: { type: 'string' },
    aangemaaktOp: { type: 'string', format: 'date-time' }
  }
};

export const chatbotOverzichtJsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    botNaam: { type: 'string' },
    status: { type: 'string' },
    aangemaaktOp: { type: 'string', format: 'date-time' }
  }
};

export const maakDatabronJsonSchema = {
  type: 'object',
  required: ['type'],
  properties: {
    type: { type: 'string', enum: ['PDF', 'CSV', 'TXT', 'WEBSITE', 'BESTAND'] },
    bestandsUrl: { type: 'string', format: 'uri' },
    websiteUrl: { type: 'string', format: 'uri' }
  }
};

export const updateDatabronJsonSchema = {
  type: 'object',
  properties: {
    bestandsUrl: { type: 'string', format: 'uri' },
    websiteUrl: { type: 'string', format: 'uri' }
  }
};

export const voegTekstToeJsonSchema = {
  type: 'object',
  required: ['onderwerp', 'inhoud'],
  properties: {
    onderwerp: { type: 'string' },
    inhoud: { type: 'string' }
  }
};

// Export types
export type ChatbotBase = z.infer<typeof chatbotBaseSchema>;
export type MaakChatbot = z.infer<typeof maakChatbotSchema>;
export type UpdateChatbot = z.infer<typeof updateChatbotSchema>;
export type WidgetStyling = z.infer<typeof widgetStylingSchema>;
export type Databron = z.infer<typeof databronSchema>;
export type WebsiteCrawl = z.infer<typeof websiteCrawlSchema>;
export type ChatbotResponse = z.infer<typeof chatbotResponseSchema>;
export type ChatbotDetailResponse = z.infer<typeof chatbotDetailResponseSchema>;
export type ChatbotStatistieken = z.infer<typeof chatbotStatistiekenSchema>;
export type WidgetEmbed = z.infer<typeof widgetEmbedSchema>;
