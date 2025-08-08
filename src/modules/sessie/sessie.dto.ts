import type { SessieStatusType, DeviceTypeType } from './sessie.types.js';

/**
 * DTO voor het aanmaken van een nieuwe sessie
 */
export interface MaakSessie {
  gebruikerId: string;
  ipAdres: string;
  userAgent: string;
  device?: {
    type: DeviceTypeType;
    browser?: string;
    os?: string;
    isMobile: boolean;
  };
}

/**
 * DTO voor het bijwerken van een sessie
 */
export interface UpdateSessie {
  laatsteActiviteit?: Date;
  status?: SessieStatusType;
  ipAdres?: string;
}

/**
 * Interface voor sessie details
 */
export interface SessieDetail {
  id: string;
  gebruikerId: string;
  token: string;
  status: SessieStatusType;
  ipAdres: string;
  userAgent: string;
  deviceType: DeviceTypeType;
  browser?: string;
  os?: string;
  isMobile: boolean;
  laatsteActiviteit: Date;
  verlooptOp: Date;
  aangemaaktOp: Date;
  bijgewerktOp: Date;
  gebruiker?: {
    id: string;
    voornaam: string;
    tussenvoegsel?: string;
    achternaam: string;
    email: string;
  };
}

/**
 * Interface voor sessie overzicht (voor gebruiker)
 */
export interface SessieOverzicht {
  id: string;
  status: SessieStatusType;
  ipAdres: string;
  deviceType: DeviceTypeType;
  browser?: string;
  os?: string;
  isMobile: boolean;
  isHuidigeSessie: boolean;
  laatsteActiviteit: Date;
  aangemaaktOp: Date;
  locatie?: {
    stad?: string;
    land?: string;
  };
}

/**
 * Interface voor actieve sessies overzicht
 */
export interface ActieveSessies {
  totaalActief: number;
  sessies: SessieOverzicht[];
  huidigeSessie?: SessieOverzicht;
}

/**
 * Interface voor sessie statistieken
 */
export interface SessieStatistieken {
  totaalSessies: number;
  actieveSessies: number;
  verlopenSessies: number;
  geblokkeerdeIpAdressen: number;
  populairsteDevices: Array<{
    type: DeviceTypeType;
    aantal: number;
  }>;
  recenteActiviteit: Array<{
    datum: Date;
    aantalSessies: number;
  }>;
}

/**
 * Response interface voor sessie acties
 */
export interface SessieResponse {
  id: string;
  token?: string;
  status: SessieStatusType;
  verlooptOp: Date;
  message?: string;
}
