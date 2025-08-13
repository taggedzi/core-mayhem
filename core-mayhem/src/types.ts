// types.ts
import type { Body } from 'matter-js';

export type Side = -1 | 1;
export const SIDE = { LEFT: -1 as Side, RIGHT: 1 as Side } as const;

export interface Vec {
  x: number;
  y: number;
}

export type AmmoType = 'basic' | 'heavy' | 'volatile' | 'emp' | 'repair' | 'shield';

export interface Settings {
  seed: number;
  chaos: number;
  spawnRate: number;
  targetAmmo: number;
  timescale: number;
  loop: boolean;
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
