import type { Settings } from './types';

export const DEFAULTS: Settings = {
  seed: Date.now() | 0,
  chaos: 0.7,
  spawnRate: 26,
  targetAmmo: 80,
  timescale: 0.7,
  loop: false,
  pipeUpSpeed: 22,
  pipeUpGain: 3.2,
};

// Global “line” thickness for physical geometry (px)
export const WALL_T = 6;
export const WALL_PHYS_T = 24; // collider thickness (invisible)

// thin border stroke for boxes (unused)
export const BIN_INTAKE_H = 6; // height of the visible intake strip

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
  // Slight bump so missiles have a bit more energy off the rail
  missile: 0.75,
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

// Time between individual missile launches (ms)
export const MISSILE_STAGGER_MS = 300; // increase to reduce early self-collisions

// Enable/disable missile homing globally
export const HOMING_ENABLED = true;

// Homing parameters (units are per-second for accel/turn; speeds match your current scale)
export const HOMING = {
  // Speed and turn tuned for visibly curving flight without heavy compute
  maxSpeed: 12,
  accelPerSec: 9,
  maxTurnRadPerSec: 3.8,
  // Ensure missiles never stall completely while homing
  minSpeed: 3,
  // Apply a tiny upward bias only when the missile has dipped below the target
  // to counter gentle gravity; kept small to avoid overshoot (degrees)
  liftBiasDeg: 8,
  ttlMs: 7000,
  fuseRadius: 0,
} as const;

// Visual thickness of the shield ring in pixels (scales a bit with H too)
// SHIELD_RING_PX (unused)

// Explosions (projectiles pop on any contact + nearby push)
export const EXPLOSION = {
  enabled: true,
  radius: 42,
  force: 0.012,
  graceMs: 80,
  maxPerSec: 40,
  ammoDestroyPct: 0.25,
} as const;

// SHOTS_PER_FILL (unused)

export const DAMAGE = {
  cannon: 3,
  missile: 27,
  mortar: 18,
  laserDps: 40,
} as const;

// SHIELD_EFFECT (unused)

export const REPAIR_EFFECT = {
  segmentsToHeal: 3,
  segHealAmount: 85,
  centerChance: 0.5,
  centerAmount: 90,
} as const;

// CORE_RIM_WIDTH_R (unused)

// SHIELD_RING_WIDTH_R (unused)
export const SHIELD_RING_GLOW = 12;
export const SHIELD_RING_COLOR = 'rgba(120, 200, 255, 0.95)';

// Shield visual effects (shimmer/lightning)
export const SHIELD_VFX = {
  shimmer: {
    enabled: true,
    count: 10, // short moving arcs around the ring
    spanDeg: 22,
    width: 2,
    alpha: 0.35,
    speed: 0.0016, // radians/ms drift
  },
  sparks: {
    enabled: true,
    count: 4, // base per-frame sparks near the ring
    len: 12,
    alpha: 0.6,
  },
} as const;

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

// DEBUG_DAMAGE (unused)

export const MATCH_LIMIT = {
  enabled: true,
  ms: 30 * 60 * 1000,
} as const;

export const MODS = {
  buffDurationMs: 30000,
  buffMultiplier: 1.6,
  // New: immediate shield buff amount (points added to shield pool)
  buffShieldPoints: 120,
  // New: which buffs are in the random pool (used by applyRandomBuff)
  allowedBuffs: ['damage', 'shield', 'binBoost'] as const,
  // New: selection mode for triggers; switched to 'randomPool' per request
  buffChooser: 'randomPool' as 'damageOnly' | 'randomPool',
  // New: cooldown haste (x multiplier applied to weapon cooldowns when active)
  cooldownBuffMultiplier: 0.65,
  // New: bin booster (multiplier to bin fill per deposit) and duration
  binBoostMultiplier: 1.8,
  binBoostDurationMs: 20000,
  debuffDurationMs: 30000,
  allowedDebuffs: ['cannon', 'laser', 'missile', 'mortar'] as const,
} as const;

// ---- Modular placement specs (mirrored like bins) ----

type WeaponId = 'cannon' | 'laser' | 'missile' | 'mortar';

// Weapon row placement using the existing computed layout rules.
// - row 'top' uses the same top row as cannon/laser/missile spaced by core radius.
// - row 'bottom' is the artillery row near the bottom.
interface WeaponSpec {
  id: WeaponId;
  row: 'top' | 'bottom';
  order: number; // index along the row from nearest midline outward (0,1,2,...)
  enabled?: boolean;
}

// Left-side only; right mirrors automatically
export const WEAPONS_LEFT: readonly WeaponSpec[] = [
  { id: 'cannon', row: 'top', order: 0 },
  { id: 'laser', row: 'top', order: 1 },
  { id: 'missile', row: 'top', order: 2 },
  { id: 'mortar', row: 'bottom', order: 0 },
] as const;

// Paddles positioned inside the pins field using fractions of the pin-field width.
// pos: [xFrac, yFrac] where xFrac=0 at left edge of pins field and 1 at right edge
interface PaddleSpec {
  pos: [number, number];
  amp: number;
  spd: number;
  dir: -1 | 1; // initial sweep direction for the left-side copy; right will mirror
  enabled?: boolean;
}

// Left-side paddle definitions; right mirrors x automatically and flips dir
export const PADDLES_LEFT: readonly PaddleSpec[] = [
  { pos: [0.3, 0.6], amp: 28, spd: 1.2, dir: +1 },
  { pos: [0.7, 0.6], amp: 28, spd: 1.2, dir: -1 },
] as const;

// Gel rectangles inside the pins field.
interface GelSpec {
  pos: [number, number]; // center in fractions; x relative to pins field, y relative to canvas height
  sizeFrac: [number, number]; // [width as fraction of pinsWidth, height as fraction of H]
  dampX?: number;
  dampY?: number;
  enabled?: boolean;
}

// Left-side gel definitions; right mirrors x automatically
export const GELS_LEFT: readonly GelSpec[] = [
  { pos: [0.5, 0.14], sizeFrac: [0.96, 0.06], dampX: 2.2, dampY: 3.2 },
] as const;

// Subtle ambient visuals to keep attention without distracting from gameplay
export const MESMER = {
  enabled: true,
  mode: 'always' as 'off' | 'low' | 'always', // show mesmer regardless of activity
  fadeMs: 1400, // smoothing time constant for fade in/out
  stars: {
    enabled: true,
    count: 70,
    color: '#1a9bff',
    altColor: '#ff00aa',
    alpha: 0.2, // tiny bump in visibility
    jitter: 0.002, // twinkle speed factor
    sizeMin: 1.1,
    sizeMax: 2.2,
  },
  arcs: {
    enabled: true,
    countPerSide: 2,
    baseRFrac: 0.18, // of min(W,H)
    gapRFrac: 0.055,
    width: 10,
    alpha: 0.06,
    blur: 20,
  },
  vignette: {
    enabled: true,
    innerFrac: 0.55, // radius where effect starts (transparent)
    outerFrac: 1.0, // radius where it reaches full alpha
    alpha: 0.35, // strength at outer radius
    color: 'rgba(0,0,0,1)',
  },
} as const;

// Subtle top-band visual that hints at momentum without distraction
// (TOP_BAND removed)

// Arcade-style mirrored LED panel centered at top
export const LIGHT_PANEL = {
  enabled: true,
  y: 38, // vertical position of the main row center
  cell: 10, // LED diameter/size (px)
  gap: 6, // spacing between LEDs (px)
  margin: 8, // inset from the inner pipe walls
  widthFrac: 0.5, // max width as a fraction of screen (centered)
  baseAlpha: 0.14, // unlit pad visibility (0=black)
  litAlpha: 0.7, // lit LED alpha (combined with additive glow)
  glow: 10, // blur/glow radius for lit LEDs
  progressTauMs: 500, // smoothing time constant for advantage movement
  // Advantage sensitivity shaping (makes small differences show more lights)
  advScale: 2.0, // gain applied to raw advantage before shaping
  advGamma: 0.6, // <1 expands near zero (0.6–0.8 recommended)
  damageTauMs: 350, // smoothing for damage bar decay
  damageScale: 0.15, // scales raw activity before curve (lower = each hit counts less)
  damageCurveK: 3.0, // asymptotic growth (higher = faster overall approach to 1)
  damageGamma: 3.0, // >1 makes early growth slower; try 1.4–1.8 for conservative start
  // Dynamic asymptote: renormalize by the largest recent activity so far (upward-only).
  damageDynamicMax: true,
  damagePeakDecayMs: 10000, // 0 = no decay; try 15000 for a very slow relaxation over time
  damageHeadroom: 1.0, // >1 keeps headroom so even current peak won't max out
  // second row (damage reaction)
  damageRow: { enabled: true, dy: 14, color: '#ff4b4b', baseAlpha: 0.06, glow: 14 } as const,
} as const;

type BinId = 'cannon' | 'laser' | 'missile' | 'mortar' | 'shield' | 'repair' | 'buff' | 'debuff';

type AmmoKind = 'basic' | 'heavy' | 'volatile' | 'emp' | 'shield' | 'repair';
export type IntakeSide = 'top' | 'bottom' | 'left' | 'right';

interface BinStyle {
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
