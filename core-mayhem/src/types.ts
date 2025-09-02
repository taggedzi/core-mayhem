// types.ts
import type { Body } from 'matter-js';

export type Side = -1 | 1;
export const SIDE = { LEFT: -1 as Side, RIGHT: 1 as Side } as const;

export interface Vec {
  x: number;
  y: number;
}

export type AmmoType = 'basic' | 'heavy' | 'volatile' | 'emp' | 'repair' | 'shield';

// Weapon kinds used across sim/render
export type WeaponKind = 'cannon' | 'laser' | 'missile' | 'mortar';

// Temporary side modifiers (buffs/debuffs)
export interface SideMods {
  dmgUntil: number;
  dmgMul: number;
  disableUntil: number;
  disabledType: WeaponKind | null;
}

export interface Settings {
  seed: number;
  chaos: number;
  spawnRate: number;
  targetAmmo: number;
  timescale: number;
  loop: boolean;
  // Pipe vertical lift tuning (used by obstacles.applyPipeForces)
  pipeUpSpeed?: number; // px/s toward upward target velocity
  pipeUpGain?: number; // 1/s responsiveness (higher = snappier)
}

export interface Bin {
  body: Body;
  accept: readonly AmmoType[]; // ✅ satisfies eslint array-type
  fill: number; // current amount
  cap: number; // capacity
  label: string;
}

export interface Bins {
  cannon: Bin;
  laser: Bin;
  missile: Bin;
  mortar: Bin;
  shield: Bin;
  repair: Bin;
  buff?: Bin;
  debuff?: Bin;
}
