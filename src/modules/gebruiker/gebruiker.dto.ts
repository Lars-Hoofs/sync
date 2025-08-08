// DTOs zijn praktisch hetzelfde als onze Zod schemas, maar specifiek voor TypeScript types
import type { GebruikerResponse } from './gebruiker.schema.js';

export {
  type GebruikerBase,
  type Registratie,
  type Login,
  type UpdateProfiel,
  type WijzigWachtwoord,
  type EmailVerificatie,
  type WachtwoordResetAanvraag,
  type WachtwoordReset,
  type GebruikerResponse,
  type LoginResponse,
} from './gebruiker.schema.js';

// Aanvullende DTOs die niet direct van schema's komen
export interface GebruikerVolledig extends GebruikerResponse {
  organisaties: {
    id: string;
    naam: string;
    slug: string;
    rol: 'EIGENAAR' | 'BEHEERDER' | 'MANAGER' | 'LID';
  }[];
  tweeFABackupCodesCount?: number;
}

export interface ProfielStatistieken {
  aantalOrganisaties: number;
  aantalChatbots: number;
  aantalSuccesvolleLogins: number;
  laatsteActiviteit: Date | null;
}

export interface AccountVerwijderBevestiging {
  email: string;
  bevestigingsTekst: string;
  wachtwoord: string;
}
