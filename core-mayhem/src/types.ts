// types.ts
import type { Body } from 'matter-js';

export type Side = -1 | 1;
export const SIDE = { LEFT: -1 as Side, RIGHT: 1 as Side } as const;

export interface Vec {
  x: number;
  y: number;
}

type AmmoType = 'basic' | 'heavy' | 'volatile' | 'emp' | 'repair' | 'shield';

// Weapon kinds used across sim/render
export type WeaponKind = 'cannon' | 'laser' | 'missile' | 'mortar';

// Temporary side modifiers (buffs/debuffs)
export interface SideMods {
  dmgUntil: number;
  dmgMul: number;
  disableUntil: number;
  disabledType: WeaponKind | null;
  // Unified slot for any timed buff (exact effect determined elsewhere)
  buffUntil?: number;
  buffKind?: string | null;
  // Optional effect fields used by specific timed buffs
  cooldownMul?: number;
  binFillMul?: number;
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
  // Global paddle speed multiplier (1 = default spec speed; <1 slows)
  paddleSpeedMul?: number;
  // Global paddle amplitude multiplier (1 = spec; >1 widens sweep)
  paddleAmpMul?: number;
  // Diagnostics: control side processing order and arena mirroring
  altOrderMode?: 'LR' | 'RL' | 'alternateTick' | 'alternateMatch';
  mirrorArena?: boolean;
}

interface Bin {
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
