import type { OrganisatieRol, UitnodigingStatusType } from './uitnodiging.types.js';

/**
 * DTO voor het maken van een nieuwe uitnodiging
 */
export interface MaakUitnodiging {
  email: string;
  rol: OrganisatieRol;
  organisatieId: string;
  bericht?: string;
}

/**
 * DTO voor het beantwoorden van een uitnodiging
 */
export interface BeantwoordUitnodiging {
  accepteer: boolean;
}

/**
 * DTO voor het bijwerken van een uitnodiging
 */
export interface UpdateUitnodiging {
  rol?: OrganisatieRol;
  bericht?: string;
}

/**
 * Interface voor uitnodiging details
 */
export interface UitnodigingDetail {
  id: string;
  email: string;
  rol: OrganisatieRol;
  status: UitnodigingStatusType;
  bericht?: string;
  token: string;
  verlooptOp: Date;
  aangemaaktOp: Date;
  bijgewerktOp: Date;
  organisatieId: string;
  uitnodigerId: string;
  organisatie: {
    id: string;
    naam: string;
    beschrijving?: string;
    logo?: string;
  };
  uitnodiger: {
    id: string;
    voornaam: string;
    tussenvoegsel?: string;
    achternaam: string;
    email: string;
  };
}

/**
 * Interface voor uitnodiging overzicht (lijst)
 */
export interface UitnodigingOverzicht {
  id: string;
  email: string;
  rol: OrganisatieRol;
  status: UitnodigingStatusType;
  aangemaaktOp: Date;
  verlooptOp: Date;
  organisatie: {
    naam: string;
    logo?: string;
  };
  uitnodiger: {
    voornaam: string;
    tussenvoegsel?: string;
    achternaam: string;
  };
}

/**
 * Interface voor openstaande uitnodigingen van gebruiker
 */
export interface MijnUitnodigingen {
  id: string;
  rol: OrganisatieRol;
  status: UitnodigingStatusType;
  bericht?: string;
  aangemaaktOp: Date;
  verlooptOp: Date;
  organisatie: {
    id: string;
    naam: string;
    beschrijving?: string;
    logo?: string;
  };
  uitnodiger: {
    voornaam: string;
    tussenvoegsel?: string;
    achternaam: string;
    email: string;
  };
}

/**
 * Response interface voor uitnodiging acties
 */
export interface UitnodigingResponse {
  id: string;
  email: string;
  rol: OrganisatieRol;
  status: UitnodigingStatusType;
  organisatieId: string;
  message?: string;
}
