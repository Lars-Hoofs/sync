/**
 * Sessie status enum
 */
export enum SessieStatus {
  ACTIEF = 'ACTIEF',
  VERLOPEN = 'VERLOPEN',
  UITGELOGD = 'UITGELOGD',
  GEBLOKKEERD = 'GEBLOKKEERD'
}

/**
 * Type voor sessie status
 */
export type SessieStatusType = keyof typeof SessieStatus;

/**
 * Device types voor sessie tracking
 */
export enum DeviceType {
  DESKTOP = 'DESKTOP',
  MOBILE = 'MOBILE',
  TABLET = 'TABLET',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Type voor device type
 */
export type DeviceTypeType = keyof typeof DeviceType;
