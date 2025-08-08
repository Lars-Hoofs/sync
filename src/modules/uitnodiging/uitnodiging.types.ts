/**
 * Uitnodiging status enum
 */
export enum UitnodigingStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED'
}

/**
 * Type voor uitnodiging status
 */
export type UitnodigingStatusType = keyof typeof UitnodigingStatus;

/**
 * Type voor organisatie rol (hergebruikt van organisatie module)
 */
// Import shared OrganisatieRol from shared types
import type { OrganisatieRol as SharedOrganisatieRol } from '../../shared/types/index.js';
export type OrganisatieRol = SharedOrganisatieRol;
