// state.ts
import type { Core } from './sim/core';
import type { Pipe } from './sim/obstacles';
import type { Settings, Bins, Side, SideMods } from './types';
import type { WeaponsType } from './sim/weapons';
import type { Engine, Runner, World, Body } from 'matter-js';

export interface FxSweep {
  x: number;
  y: number;
  t0: number; // ms start
  ms: number; // duration
  a0: number; // start angle (rad)
  a1: number; // end angle (rad)
  side: Side;
}

export interface FxArm {
  x: number;
  y: number;
  until: number; // timestamp (ms) when it disappears
  color: string;
}

export type FxImpactKind = 'burst' | 'burn';
export interface FxImpact {
  x: number;
  y: number;
  t0: number;
  ms: number;
  color: string;
  kind: FxImpactKind;
  power?: number | undefined; // used to scale ring size/intensity
}

// Modern laser FX (beam segments with explicit end time)
export interface FxLaserBeam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  side: Side;
  t0: number;
  tEnd: number;
}

// Muzzle/impact flash with lifetime
export interface FxBurst {
  x: number;
  y: number;
  t0: number;
  tEnd: number;
  side: Side;
  kind: string;
}

export interface FxBeam {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t0: number;
  ms: number;
  side: Side;
}

export interface FxSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t0: number;
  ms: number;
  color: string;
}

export interface Cooldowns {
  cannon: number;
  laser: number;
  missile: number;
  mortar: number;
}

export interface SimCooldowns {
  L: Cooldowns;
  R: Cooldowns;
}

// ——— Main state shape ———
export interface SimState {
  // Matter
  engine: Engine | null;
  runner: Runner | null;
  world: World | null;

  // Canvas / metrics
  W: number;
  H: number;
  dpr: number;

  // Lifecycle
  started: boolean;

  // Game objects / config
  settings: Settings | null;
  coreL: Core | null;
  coreR: Core | null;
  binsL: Bins | null;
  binsR: Bins | null;

  // Weapon mounts/positions
  wepL: WeaponsType | null;
  wepR: WeaponsType | null;

  // Bodies/actors
  gels: Body[];
  rotors: Body[];
  paddles: Body[];
  flippers: Body[];
  pipes: Pipe[];
  homing: Body[]; // missiles to steer each frame

  // FX (transient visuals)
  fxSweep: FxSweep[];
  fxArm: FxArm[];
  fxImp: FxImpact[];
  fxBeam: FxBeam[];
  fxBeams?: FxLaserBeam[]; // modern
  fxBursts?: FxBurst[]; // modern
  fxSparks?: FxSpark[];

  // Resources / timers
  ammoL: number;
  ammoR: number;
  spawnAcc: number;
  cooldowns: SimCooldowns;

  // Side modifiers (buffs / temporary disables)
  modsL: SideMods;
  modsR: SideMods;

  // Screen shake (optional)
  shakeT0?: number;
  shakeMs?: number;
  shakeAmp?: number;

  // Match outcome
  gameOver?: boolean;
  winner?: Side | 0 | null;
  winnerAt?: number;

  // Visual runtime toggles
  mesmerMode?: 'off' | 'low' | 'always';
  mesmerFade?: number; // 0..1 smoothed visibility for mesmer layer
  mesmerLastT?: number; // last timestamp used for fade smoothing
}

// ——— Factory + singleton ———
export function createSimState(): SimState {
  return {
    engine: null,
    runner: null,
    world: null,

    W: 0,
    H: 0,
    dpr: 1,

    started: false,

    settings: null,
    coreL: null,
    coreR: null,
    binsL: null,
    binsR: null,

    wepL: null,
    wepR: null,

    gels: [],
    rotors: [],
    paddles: [],
    flippers: [],
    pipes: [],
    homing: [],

    fxSweep: [],
    fxArm: [],
    fxImp: [],
    fxBeam: [],
    fxBeams: [],
    fxBursts: [],
    fxSparks: [],

    ammoL: 0,
    ammoR: 0,
    spawnAcc: 0,
    cooldowns: {
      L: { cannon: 0, laser: 0, missile: 0, mortar: 0 },
      R: { cannon: 0, laser: 0, missile: 0, mortar: 0 },
    },

    // Default modifiers
    modsL: { dmgUntil: 0, dmgMul: 1, disableUntil: 0, disabledType: null },
    modsR: { dmgUntil: 0, dmgMul: 1, disableUntil: 0, disabledType: null },

    // Match outcome defaults
    gameOver: false,
    winner: null,
    winnerAt: 0,

    mesmerMode: undefined,
    mesmerFade: 0,
    mesmerLastT: 0,
  };
}

// Export the app-wide instance
export const sim: SimState = createSimState();

// Optional: utility to wipe transient/volatile parts between runs
export function resetSimState(s: SimState = sim): void {
  s.gels.length = 0;
  s.rotors.length = 0;
  s.paddles.length = 0;
  s.flippers.length = 0;
  s.pipes.length = 0;
  s.homing.length = 0;
  s.fxSweep.length = 0;
  s.fxArm.length = 0;
  s.fxImp.length = 0;
  s.fxBeam.length = 0;
  if (s.fxBeams) s.fxBeams.length = 0;
  if (s.fxBursts) s.fxBursts.length = 0;
  if (s.fxSparks) s.fxSparks.length = 0;

  s.ammoL = 0;
  s.ammoR = 0;
  s.spawnAcc = 0;
  s.cooldowns.L = { cannon: 0, laser: 0, missile: 0, mortar: 0 };
  s.cooldowns.R = { cannon: 0, laser: 0, missile: 0, mortar: 0 };

  // Reset modifiers to neutral state
  s.modsL = { dmgUntil: 0, dmgMul: 1, disableUntil: 0, disabledType: null };
  s.modsR = { dmgUntil: 0, dmgMul: 1, disableUntil: 0, disabledType: null };

  // Reset match outcome
  s.gameOver = false;
  s.winner = null;
  s.winnerAt = 0;
}
