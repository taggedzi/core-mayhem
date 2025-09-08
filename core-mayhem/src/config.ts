import type { Settings } from './types';

// Logical canvas size (world units); rendering scales to fit screen
export const CANVAS = { width: 1920, height: 1039 } as const;

export const DEFAULTS: Settings = {
  seed: Date.now() | 0,
  chaos: 0.7,
  spawnRate: 26,
  targetAmmo: 80,
  timescale: 0.7,
  loop: false,
  pipeUpSpeed: 22,
  pipeUpGain: 3.2,
  // Slow paddles slightly for clearer interactions
  paddleSpeedMul: 0.6,
  // Expand paddle sweep width relative to spec
  paddleAmpMul: 6.0,
  altOrderMode: 'alternateTick', // 'LR' | 'RL' | 'alternateTick' | 'alternateMatch'
  mirrorArena: false,
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
  segments: 200,
  center: 500,
  shieldMax: 50,
} as const;

export const CORE_SEGMENTS = 12;
// Absolute core geometry for LEFT side; RIGHT is mirrored automatically
// pos is bottom-left of the bounding square (not the center)
export const CORE = {
  // pos is bottom-left (BL) of the bounding square
  pos: [580, 400] as [number, number],
  radius: 120 as number,
  edgeMarginPx: 40 as number,
} as const;

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

// Absolute overlay badge placement (UI status badges)
// Positions are specified for the LEFT side; RIGHT is mirrored automatically.
// Coordinates use the project’s logical system: origin at bottom-left and Y increases upward.
// Badges are drawn centered on these positions, so variable text width will not affect mirroring.
export const BADGES = {
  enabled: true,
  // Center positions for each badge on the LEFT side
  left: {
    buff: [530, 980] as [number, number],
    debuff: [530, 950] as [number, number],
  },
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

interface PaddleSpec {
  // Absolute bottom-left position (px) of a fixed 80x8 paddle
  pos: [number, number];
  amp: number;
  spd: number;
  dir: -1 | 1; // initial sweep direction for the left-side copy; right will mirror
  enabled?: boolean;
}

// Left-side absolute paddles; right mirrors x automatically and flips dir
export const PADDLES_LEFT: readonly PaddleSpec[] = [
  { pos: [157, 428], amp: 24, spd: 1.4, dir: +1 },
  { pos: [326, 385], amp: 28, spd: 1.1, dir: -1 },
  { pos: [250, 975], amp: 30, spd: 1.3, dir: -1 },
] as const;

interface GelSpec {
  // Absolute bottom-left position and size in px
  pos: [number, number];
  size: [number, number];
  dampX?: number;
  dampY?: number;
  enabled?: boolean;
}

// Left-side gel definitions; right mirrors x automatically
export const GELS_LEFT: readonly GelSpec[] = [
  { pos: [79, 896], size: [406, 65], dampX: 2.2, dampY: 3.2 },
] as const;

// Subtle ambient visuals to keep attention without distracting from gameplay
export const MESMER = {
  enabled: true,
  mode: 'always' as 'off' | 'low' | 'always',
  fadeMs: 1400,
  stars: {
    enabled: true,
    count: 70,
    color: '#1a9bff',
    altColor: '#ff00aa',
    alpha: 0.3,
    jitter: 0.004,
    sizeMin: 1,
    sizeMax: 2,
  },
  arcs: {
    enabled: true,
    countPerSide: 2,
    baseR: 194,
    gapPx: 59,
    width: 10,
    alpha: 0.06,
    blur: 20,
  },
} as const;

// Subtle top-band visual that hints at momentum without distraction
// (TOP_BAND removed)

// Arcade-style mirrored LED panel centered at top
// Absolute light panel placement; drawn using integer pixels (refactor in renderer later)
export const LIGHT_PANEL = {
  enabled: true,
  x: 480, // left edge
  // Bottom-left y of main row center
  y: 1042,
  width: 900, // total width of the panel area
  cell: 10, // LED diameter/size (px)
  gap: 6, // spacing between LEDs (px)
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
  damageDynamicMax: true,
  damagePeakDecayMs: 10000,
  damageHeadroom: 1.0,
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
  // Absolute integer bottom-left position and size (px)
  pos: [number, number];
  size: [number, number];
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
    // bottom-left position
    pos: [35, 202],
    size: [70, 27],
    intake: 'top',
    label: 'Cannon',
    style: { fill: '#480072' },
  },
  {
    id: 'laser',
    accepts: ['basic', 'emp'],
    cap: 25,
    pos: [225, 202],
    size: [70, 27],
    intake: 'top',
    label: 'Laser',
    style: { fill: '#ff5d5d' },
  },
  {
    id: 'missile',
    accepts: ['heavy', 'volatile'],
    cap: 15,
    pos: [365, 256],
    size: [70, 27],
    intake: 'top',
    label: 'Missile',
    style: { fill: '#ffb84d' },
  },
  {
    id: 'buff',
    accepts: ['basic', 'heavy', 'emp', 'shield', 'repair'],
    cap: 50,
    pos: [500, 289],
    size: [70, 27],
    intake: 'top',
    label: 'Buff',
    style: { fill: '#5CFF7A' },
  },
  {
    id: 'mortar',
    accepts: ['basic', 'heavy'],
    cap: 24,
    pos: [141, 105],
    size: [70, 27],
    intake: 'top',
    label: 'Mortar',
    style: { fill: '#bd9cff' },
  },
  {
    id: 'shield',
    accepts: ['emp', 'shield'],
    cap: 45,
    pos: [289, 105],
    size: [70, 27],
    intake: 'top',
    label: 'Shield',
    style: { fill: '#72f0ff' },
  },
  {
    id: 'repair',
    accepts: ['repair', 'heavy'],
    cap: 30,
    pos: [436, 181],
    size: [70, 27],
    intake: 'top',
    label: 'Repair',
    style: { fill: '#9cff72' },
  },
  {
    id: 'debuff',
    accepts: ['basic', 'heavy', 'volatile', 'emp', 'shield'],
    cap: 45,
    pos: [605, 267],
    size: [70, 27],
    intake: 'top',
    label: 'Debuff',
    style: { fill: '#FF6B6B' },
  },
] as const;

// How shields behave (ablative pool)
export const SHIELD = {
  startHP: 200,
  maxHP: 400,
  onPickup: 60,
  projectileFactor: 1.0,
  laserPenetration: 0.35,
  laserShieldFactor: 1.2,
} as const;

// Absolute pipe geometry (channel between walls) and intake sensor (left-side only; right mirrors)
export const PIPES = {
  channel: {
    // Bottom-left position and size of the inner channel (between the two vertical walls)
    pos: [-3, 81] as [number, number],
    size: [60, 891] as [number, number],
  },
  intake: {
    // Bottom-left position and size of the side intake sensor (off-screen on left)
    pos: [-115, 85] as [number, number],
    size: [110, 36] as [number, number],
  },
} as const;

// Procedural pins/rotors (absolute integer parameters)
export const PINS = {
  width: 450, // pin-field width in px
  startY: 800, // bottom-left Y to first row center (moved down ~20px)
  rows: 9,
  sx: 42, // horizontal spacing
  sy: 35, // vertical spacing
  rotorEvery: 3, // every Nth row becomes rotors
  pinRadius: 4,
  rotorRadius: 12,
  edgeMargin: 18, // keep pins/rotors this far from field edges
} as const;

// Absolute weapon mount points (circular; pos = bottom-left of bounding box, r = radius)
export interface WeaponMountSpec {
  id: WeaponId;
  pos: [number, number]; // bottom-left of bounding circle
  r: number; // radius
  enabled?: boolean;
}

export const WEAPON_MOUNTS_LEFT: readonly WeaponMountSpec[] = [
  { id: 'cannon', pos: [859, 935], r: 5 },
  { id: 'laser', pos: [751, 881], r: 5 },
  { id: 'missile', pos: [643, 827], r: 5 },
  { id: 'mortar', pos: [901, 275], r: 5 },
] as const;
