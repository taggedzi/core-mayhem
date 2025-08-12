import type { Settings } from './types';

export const COLORS = {
  bg: '#0b0f1a',
  left: '#ff8c1a',
  right: '#1a9bff',
  accent: '#ff00aa',
} as const;

export const DEFAULTS: Settings = {
  seed: Date.now() | 0,
  chaos: 0.7,
  spawnRate: 26,
  targetAmmo: 100,
  timescale: 0.9,
  loop: false,
};

// Pipe behavior (not part of Settings)
export const PIPES = {
  upSpeed: 28, // px/sec the ammo tries to climb
  upGain: 2.2, // how aggressively we steer toward that speed (1/s)
} as const;

export const UI = {
  // Rendering sizes get recomputed on resize in world.ts
  pinRows: 9,
};

// Global “line” thickness for physical geometry (px)
export const WALL_T = 6;
export const WALL_PHYS_T = 24; // collider thickness (invisible)

export const BIN_T = 2; // thin border stroke for boxes
export const BIN_INTAKE_H = 6; // height of the visible intake strip

// Spread multipliers for bin placement (1 = previous layout)
export const BIN_H_SPREAD = 1.35; // ~+20% horizontal
export const BIN_V_SPREAD = 1.25; // ~+10% vertical

// Global wind-up (arming) delay
export const WEAPON_WINDUP_MS = 3000;

// Per-weapon cooldowns (ms)
export const COOLDOWN_MS = {
  cannon: 1200,
  laser: 900,
  missile: 1600,
  mortar: 1400,
} as const;

// Scale initial projectile speeds (1 = old speed). Lower = slower/easier to track.
export const PROJ_SPEED = {
  cannon: 0.8,
  laser: 1.0, // laser beam stays instant-ish; visual burn handles feedback
  missile: 0.65,
  mortar: 0.55,
} as const;

// Simple impact effect durations
export const FX_MS = {
  impact: 450, // burst (cannon/missile/mortar)
  burn: 700, // scorch (laser)
} as const;

// How wide the launcher fans missiles (in degrees)
export const MISSILE_SPREAD_DEG = 90; // try 26–34 for obvious spread
export const MISSILE_JITTER_DEG = 20; // random per-missile wobble at launch

// NEW: tilt the entire missile arc relative to the aim-to-target direction
// Negative tilts aim the arc more upward (screen up).
export const MISSILE_ARC_TILT_DEG = -55; // tweak to taste

// Enable/disable missile homing globally
export const HOMING_ENABLED = true;

// Homing parameters (units are per-second for accel/turn; speeds match your current scale)
export const HOMING = {
  maxSpeed: 9,
  accelPerSec: 6,
  maxTurnRadPerSec: 3.2,
  ttlMs: 7000,
  fuseRadius: 0,
} as const;

// How fast shield value drains (per second). Set to 0 to disable decay.
export const SHIELD_DECAY_PER_SEC = 0.05;

// Visual thickness of the shield ring in pixels (scales a bit with H too)
export const SHIELD_RING_PX = 6;

// Explosions (projectiles pop on any contact + nearby push)
export const EXPLOSION = {
  enabled: true,
  radius: 42,
  force: 0.012,
  graceMs: 80,
  maxPerSec: 40,
  ammoDestroyPct: 0.25,
} as const;

// === Ammo / weapon economy knobs ===

export const CONTAINER_CAP = {
  cannon: 100,
  laser: 5,
  missile: 6,
  mortar: 2,
  repair: 250,
  shield: 125,
} as const;

export const SHOTS_PER_FILL = {
  cannon: 20,
  missile: 8,
  mortar: 1,
  laserMs: 800,
} as const;

export const DAMAGE = {
  cannon: 3,
  missile: 27,
  mortar: 18,
  laserDps: 40,
} as const;

export const SHIELD_EFFECT = {
  gain: 20,
} as const;

export const REPAIR_EFFECT = {
  segmentsToHeal: 3,
  segHealAmount: 85,
  centerChance: 0.5,
  centerAmount: 90,
} as const;

export const CORE_RIM_WIDTH_R = 0.06;

export const SHIELD_RING_WIDTH_R = 0.1;
export const SHIELD_RING_GLOW = 12;
export const SHIELD_RING_COLOR = 'rgba(120, 200, 255, 0.95)';

export const CORE_HP = {
  segments: 100,
  center: 500,
  shieldMax: 50,
} as const;

export const CORE_SEGMENTS = 28;

export const CORE_POS = {
  xOffsetFrac: 0.16,
  yFrac: 0.55,
  edgeMarginPx: 40,
};

export const GAMEOVER = {
  bannerMs: 10000,
  autoRestart: true,
} as const;

export const MORTAR_ANGLE = {
  angleDeg: 72,
  angleJitterDeg: 6,
  speedPerTick: 22,
  speedJitter: 0.12,
  extraGravity: 0.0,
} as const;

export const PROJECTILE_STYLE = {
  cannon: { fill: '#FFD24A', glow: '#FFC400' },
  missile: { fill: '#66CCFF', glow: '#33B5FF' },
  mortar: { fill: '#FF6B6B', glow: '#FF3B3B' },
  artillery: { fill: '#B4FF6A', glow: '#86FF2D' },
  laser: { fill: '#FFFFFF', glow: '#88CCFF' },
} as const;

export const PROJECTILE_OUTLINE = '#0B0F1A';

export const LASER_FX = {
  beamMs: 600,
  innerWidth: 3,
  outerWidth: 11,
  jitterAmp: 6,
  segments: 12,
  dash: 18,
  flashMs: 140,
  flashSize: 22,
  coreColor: '#FFFFFF',
} as const;

export const DEV_KEYS = {
  enabledInProd: false,
} as const;

export const ARMOR = {
  spillover: true,
  leakWhenBroken: 1.0,
  chipChance: 0.0,
} as const;

export const DEBUG_DAMAGE = false;

export const MATCH_LIMIT = {
  enabled: true,
  ms: 30 * 60 * 1000,
} as const;

export const MODS = {
  buffDurationMs: 30000,
  buffMultiplier: 1.6,
  debuffDurationMs: 30000,
  allowedDebuffs: ['cannon', 'laser', 'missile', 'mortar'] as const,
} as const;

export type BinId =
  | 'cannon'
  | 'laser'
  | 'missile'
  | 'mortar'
  | 'shield'
  | 'repair'
  | 'buff'
  | 'debuff';

export type AmmoKind = 'basic' | 'heavy' | 'volatile' | 'emp' | 'shield' | 'repair';
export type IntakeSide = 'top' | 'bottom' | 'left' | 'right';

export interface BinStyle {
  strokePx?: number;
  stroke?: string;
  box?: string;
  fill?: string;
  gauge?: string;
  text?: string;
}

export interface BinSpec {
  id: BinId;
  accepts: AmmoKind[];
  cap: number;
  pos: [number, number];
  sizeFrac: [number, number];
  intake: IntakeSide;
  rotation?: number;
  label?: string;
  enabled?: boolean;
  style?: BinStyle;
}

// Left-side only; right mirrors automatically
export const BINS_LEFT: readonly BinSpec[] = [
  {
    id: 'cannon',
    accepts: ['basic', 'heavy', 'volatile'],
    cap: 40,
    pos: [0, 0.8],
    sizeFrac: [0.16, 0.025],
    intake: 'top',
    label: 'Cannon',
    style: { fill: '#480072' },
  },
  {
    id: 'laser',
    accepts: ['basic', 'emp'],
    cap: 25,
    pos: [0.45, 0.8],
    sizeFrac: [0.16, 0.025],
    intake: 'top',
    label: 'Laser',
    style: { fill: '#ff5d5d' },
  },
  {
    id: 'missile',
    accepts: ['heavy', 'volatile'],
    cap: 35,
    pos: [0.78, 0.75],
    sizeFrac: [0.16, 0.025],
    intake: 'top',
    label: 'Missile',
    style: { fill: '#ffb84d' },
  },
  {
    id: 'buff',
    accepts: ['basic', 'heavy', 'emp', 'shield', 'repair'],
    cap: 50,
    pos: [1.1, 0.72],
    sizeFrac: [0.16, 0.025],
    intake: 'top',
    label: 'Buff',
    style: { fill: '#5CFF7A' },
  },
  {
    id: 'mortar',
    accepts: ['basic', 'heavy'],
    cap: 12,
    pos: [0.25, 0.89],
    sizeFrac: [0.16, 0.025],
    intake: 'top',
    label: 'Mortar',
    style: { fill: '#bd9cff' },
  },
  {
    id: 'shield',
    accepts: ['emp', 'shield'],
    cap: 45,
    pos: [0.6, 0.89],
    sizeFrac: [0.16, 0.025],
    intake: 'top',
    label: 'Shield',
    style: { fill: '#72f0ff' },
  },
  {
    id: 'repair',
    accepts: ['repair', 'heavy'],
    cap: 30,
    pos: [0.95, 0.82],
    sizeFrac: [0.16, 0.025],
    intake: 'top',
    label: 'Repair',
    style: { fill: '#9cff72' },
  },
  {
    id: 'debuff',
    accepts: ['basic', 'heavy', 'volatile', 'emp', 'shield'],
    cap: 60,
    pos: [1.35, 0.74],
    sizeFrac: [0.16, 0.025],
    intake: 'top',
    label: 'Debuff',
    style: { fill: '#FF6B6B' },
  },
] as const;

// How shields behave (ablative pool)
export const SHIELD = {
  startHP: 200,
  maxHP: 200,
  onPickup: 60,
  projectileFactor: 1.0,
  laserPenetration: 0.35,
  laserShieldFactor: 1.2,
} as const;
