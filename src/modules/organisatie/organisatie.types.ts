export type AbonnementStatus = 'PROEFPERIODE' | 'ACTIEF' | 'VERLOPEN' | 'GEANNULEERD' | 'ONBETAALD';

export type OrganisatieRol = 'EIGENAAR' | 'BEHEERDER' | 'MANAGER' | 'LID';

export interface OrganisatieContext {
  id: string;
  naam: string;
  slug: string;
  rol: import('../../shared/types/index.js').OrganisatieRol;
  rechten: string[];
  abonnementStatus: AbonnementStatus;
  maxAantalLeden?: number;
  maxApiCalls?: number;
}

export interface OrganisatieMember {
  id: string;
  gebruikerId: string;
  organisatieId: string;
  rol: import('../../shared/types/index.js').OrganisatieRol;
  isActief: boolean;
  aangemaaktOp: Date;
  bijgewerktOp: Date;
  laatsteActiviteit?: Date;
}
