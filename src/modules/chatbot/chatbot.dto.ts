import type { 
  ChatbotStatusType, 
  ChatbotTypeType, 
  AiModelType, 
  TaalType 
} from './chatbot.types.js';

/**
 * DTO voor het aanmaken van een nieuwe chatbot
 */
export interface MaakChatbot {
  organisatieId: string;
  botNaam: string;
  widgetNaam: string;
  websiteUrl?: string;
  klantenServiceEmail?: string;
  basisPrompt: string;
  toon: string;
  startBericht: string;
  styling: {
    mainKleur: string;
    secundaireKleur?: string;
    achtergrondKleur?: string;
    tekstKleur?: string;
    knopKleur?: string;
    knopTekstKleur?: string;
    knopHoverKleur?: string;
    knopHoverTekstKleur?: string;
    fontGrootte?: number;
    fontFamilie?: string;
  };
}

/**
 * DTO voor het bijwerken van een chatbot
 */
export interface UpdateChatbot {
  botNaam?: string;
  widgetNaam?: string;
  websiteUrl?: string;
  klantenServiceEmail?: string;
  basisPrompt?: string;
  toon?: string;
  startBericht?: string;
  status?: ChatbotStatusType;
  styling?: Partial<MaakChatbot['styling']>;
}

/**
 * Interface voor chatbot details
 */
export interface ChatbotDetail {
  id: string;
  organisatieId: string;
  botNaam: string;
  widgetNaam: string;
  websiteUrl?: string;
  klantenServiceEmail?: string;
  basisPrompt: string;
  toon: string;
  startBericht: string;
  status: ChatbotStatusType;
  apiSleutel?: string;
  styling: {
    mainKleur: string;
    secundaireKleur?: string;
    achtergrondKleur?: string;
    tekstKleur?: string;
    knopKleur?: string;
    knopTekstKleur?: string;
    knopHoverKleur?: string;
    knopHoverTekstKleur?: string;
    fontGrootte: number;
    fontFamilie: string;
  };
  organisatie: {
    id: string;
    naam: string;
    slug: string;
  };
  databronnen: Array<{
    id: string;
    type: string;
    bestandsUrl?: string;
    websiteUrl?: string;
    aantalTeksten: number;
    aangemaaktOp: Date;
    bijgewerktOp: Date;
  }>;
  aantalDatabronnen: number;
  aangemaaktOp: Date;
  bijgewerktOp: Date;
}

/**
 * Interface voor chatbot overzicht (lijst)
 */
export interface ChatbotOverzicht {
  id: string;
  botNaam: string;
  widgetNaam: string;
  status: ChatbotStatusType;
  websiteUrl?: string;
  aantalDatabronnen: number;
  aangemaaktOp: Date;
  bijgewerktOp: Date;
}

/**
 * Interface voor chatbot gesprek
 */
export interface ChatbotGesprek {
  id: string;
  chatbotId: string;
  sessieId?: string;
  gebruikerInfo?: {
    naam?: string;
    email?: string;
    telefoon?: string;
    metadata?: Record<string, any>;
  };
  berichten: ChatbotBericht[];
  status: 'ACTIEF' | 'AFGEROND' | 'ONDERBROKEN';
  tevredenheidScore?: number;
  feedback?: string;
  startTijd: Date;
  eindTijd?: Date;
  duur?: number;
}

/**
 * Interface voor chatbot bericht
 */
export interface ChatbotBericht {
  id: string;
  gesprekId: string;
  inhoud: string;
  isVanBot: boolean;
  metadata?: {
    tokens?: number;
    responsTijd?: number;
    confidence?: number;
    intent?: string;
    entities?: Record<string, any>;
  };
  timestamp: Date;
}

/**
 * DTO voor het versturen van een bericht
 */
export interface VerstuurBericht {
  chatbotId: string;
  gesprekId?: string;
  inhoud: string;
  gebruikerInfo?: {
    naam?: string;
    email?: string;
    telefoon?: string;
    metadata?: Record<string, any>;
  };
}

/**
 * Interface voor chatbot statistieken
 */
export interface ChatbotStatistieken {
  totaalChatbots: number;
  actieveChatbots: number;
  totaalGesprekken: number;
  totaalBerichten: number;
  gemiddeldeTevredenheid: number;
  gemiddeldeResponsTijd: number;
  populairsteModellen: Array<{
    model: AiModelType;
    aantal: number;
  }>;
  gespreksVolumePerDag: Array<{
    datum: Date;
    aantalGesprekken: number;
    aantalBerichten: number;
  }>;
  topChatbots: Array<{
    id: string;
    naam: string;
    aantalGesprekken: number;
    tevredenheid: number;
  }>;
}

/**
 * Response interface voor chatbot acties
 */
export interface ChatbotResponse {
  id: string;
  botNaam: string;
  widgetNaam: string;
  status: ChatbotStatusType;
  apiSleutel?: string;
  embedCode?: string;
  webhookUrl?: string;
  aangemaaktOp: Date;
  message?: string;
}

/**
 * DTO voor het aanmaken van een databron
 */
export interface MaakDatabron {
  naam: string;
  type: 'PDF' | 'CSV' | 'TXT' | 'WEBSITE' | 'BESTAND';
  bestandsUrl?: string;
  websiteUrl?: string;
  chatbotId: string;
}

/**
 * DTO voor het bijwerken van een databron
 */
export interface UpdateDatabron {
  bestandsUrl?: string;
  websiteUrl?: string;
}

/**
 * Response interface voor databron
 */
export interface DatabronResponse {
  id: string;
  type: string;
  bestandsUrl?: string;
  websiteUrl?: string;
  chatbotId: string;
  aangemaaktOp: Date;
  bijgewerktOp: Date;
  teksten: Array<{
    id: string;
    onderwerp: string;
    inhoud: string;
    aangemaaktOp: Date;
  }>;
}

/**
 * DTO voor het toevoegen van tekst
 */
export interface VoegTekstToe {
  onderwerp: string;
  inhoud: string;
  databronId: string;
}

/**
 * Response interface voor tekst
 */
export interface TekstResponse {
  id: string;
  onderwerp: string;
  inhoud: string;
  databronId: string;
  aangemaaktOp: Date;
  bijgewerktOp: Date;
}
