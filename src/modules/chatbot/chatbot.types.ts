/**
 * Chatbot status enum
 */
export enum ChatbotStatus {
  ACTIEF = 'ACTIEF',
  INACTIEF = 'INACTIEF',
  CONCEPT = 'CONCEPT',
  GEPUBLICEERD = 'GEPUBLICEERD',
  GEARCHIVEERD = 'GEARCHIVEERD'
}

/**
 * Type voor chatbot status
 */
export type ChatbotStatusType = keyof typeof ChatbotStatus;

/**
 * Chatbot type enum
 */
export enum ChatbotType {
  WEBSITE = 'WEBSITE',
  WHATSAPP = 'WHATSAPP',
  TELEGRAM = 'TELEGRAM',
  DISCORD = 'DISCORD',
  SLACK = 'SLACK',
  MESSENGER = 'MESSENGER'
}

/**
 * Type voor chatbot type
 */
export type ChatbotTypeType = keyof typeof ChatbotType;

/**
 * AI Model enum
 */
export enum AiModel {
  GPT_3_5_TURBO = 'GPT_3_5_TURBO',
  GPT_4 = 'GPT_4',
  GPT_4_TURBO = 'GPT_4_TURBO',
  CLAUDE_3_HAIKU = 'CLAUDE_3_HAIKU',
  CLAUDE_3_SONNET = 'CLAUDE_3_SONNET',
  GEMINI_PRO = 'GEMINI_PRO',
  CUSTOM = 'CUSTOM'
}

/**
 * Type voor AI model
 */
export type AiModelType = keyof typeof AiModel;

/**
 * Taal enum
 */
export enum Taal {
  NL = 'NL',
  EN = 'EN',
  DE = 'DE',
  FR = 'FR',
  ES = 'ES',
  IT = 'IT'
}

/**
 * Type voor taal
 */
export type TaalType = keyof typeof Taal;

/**
 * DataBronType from Prisma schema
 */
export enum DataBronType {
  PDF = 'PDF',
  CSV = 'CSV',
  TXT = 'TXT',
  WEBSITE = 'WEBSITE',
  BESTAND = 'BESTAND'
}
