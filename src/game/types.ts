export interface V3 {
  x: number;
  y: number;
  z: number;
}

/** Anything the world's rays can hit and damage. */
export interface Damageable {
  readonly isPlayer: boolean;
  hp: number;
  /** Returns true when this hit killed it. */
  damage(amount: number, from: V3): boolean;
}

/** Aim point of a body: roughly chest height above the feet. */
export const CHEST = 1.25;
export const EYES = 1.62;
