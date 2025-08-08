// DTOs export from schemas
export {
  type OrganisatieBase,
  type MaakOrganisatie,
  type UpdateOrganisatie,
  type OrganisatieInstellingen,
  type OrganisatieResponse,
  type OrganisatieDetailResponse,
  type OrganisatieStatistieken,
  type OrganisatieLid,
  type WijzigLidRol,
} from './organisatie.schema.js';

// Additional DTOs
// OrganisatieDetailResponse is exported from schema, use that directly

export interface OrganisatieOverzicht {
  id: string;
  naam: string;
  slug: string;
  domein?: string;
  eigenaar: {
    id: string;
    voornaam: string;
    tussenvoegsel?: string;
    achternaam: string;
    email: string;
  };
  aantalLeden: number;
  aantalChatbots: number;
  abonnementStatus: 'PROEFPERIODE' | 'ACTIEF' | 'VERLOPEN' | 'GEANNULEERD' | 'ONBETAALD';
  aangemaaktOp: Date;
  bijgewerktOp: Date;
}

// OrganisatieUitgebreid can be defined when needed by extending OrganisatieDetailResponse directly

export interface OrganisatieGebruiksStatistieken {
  totaleAanroepen: number;
  gebruikteOpslag: number;
  activeChatbots: number;
  maandelijkseGrowth: number;
  topGebruikers: {
    naam: string;
    aanroepen: number;
  }[];
}

export interface OrganisatieInviteConfig {
  defaultRole: 'BEHEERDER' | 'MANAGER' | 'LID';
  autoAcceptDomains: string[];
  requireApproval: boolean;
  inviteExpireDays: number;
}
