import { Settings } from './types';
export const COLORS = { bg:'#0b0f1a', left:'#ff8c1a', right:'#1a9bff', accent:'#ff00aa' } as const;
export const DEFAULTS: Settings = { 
  seed: (Date.now()|0), 
  chaos: 0.7, 
  spawnRate: 26, 
  targetAmmo: 100, 
  timescale: .9, 
  pipeUpSpeed: 20,   // px/sec the ammo tries to climb
  pipeUpGain:  2.2, // how aggressively we steer toward that speed (1/s)
  loop:false, 
};
export const UI = {
  // Rendering sizes get recomputed on resize in world.ts
  pinRows: 9,
};
// Global “line” thickness for physical geometry (px)
export const WALL_T = 6;
export const WALL_PHYS_T = 24;   // collider thickness (invisible)

export const BIN_T = 2;           // thin border stroke for boxes
export const BIN_INTAKE_H = 6;    // height of the visible intake strip

// Spread multipliers for bin placement (1 = previous layout)
export const BIN_H_SPREAD = 1.35; // ~+20% horizontal
export const BIN_V_SPREAD = 1.25; // ~+10% vertical

// Global wind-up (arming) delay
export const WEAPON_WINDUP_MS = 1000;

// Per-weapon cooldowns (ms)
export const COOLDOWN_MS = {
  cannon: 1200,
  laser:  900,
  missile:1600,
  mortar: 1400,
} as const;

// Scale initial projectile speeds (1 = old speed). Lower = slower/easier to track.
export const PROJ_SPEED = {
  cannon: 0.80,
  laser:  1.00, // laser beam stays instant-ish; visual burn handles feedback
  missile:0.65,
  mortar: 0.55,
} as const;

// Simple impact effect durations
export const FX_MS = {
  impact: 450, // burst (cannon/missile/mortar)
  burn:   700, // scorch (laser)
} as const;

// How wide the launcher fans missiles (in degrees)
export const MISSILE_SPREAD_DEG = 90;   // try 26–34 for obvious spread
export const MISSILE_JITTER_DEG = 20;    // random per-missile wobble at launch

// NEW: tilt the entire missile arc relative to the aim-to-target direction
// Negative tilts aim the arc more upward (screen up).
export const MISSILE_ARC_TILT_DEG = -55; // tweak to taste

// Enable/disable missile homing globally
export const HOMING_ENABLED = true;

// Homing parameters (units are per-second for accel/turn; speeds match your current scale)
export const HOMING = {
  maxSpeed: 9,              // ~px per frame at 60fps (your missiles launch ~8 now)
  accelPerSec: 6,           // how fast missiles ramp toward max speed
  maxTurnRadPerSec: 3.2,    // cap on nose swing rate (radians per second)
  ttlMs: 7000,              // self-destruct safety (no effect on damage; just cleanup)
  fuseRadius: 0             // 0 = rely on normal collision; >0 = auto-detonate when this close
} as const;

// How fast shield value drains (per second). Set to 0 to disable decay.
export const SHIELD_DECAY_PER_SEC = 0.05;

// Visual thickness of the shield ring in pixels (scales a bit with H too)
export const SHIELD_RING_PX = 6;

// Explosions (projectiles pop on any contact + nearby push)
export const EXPLOSION = {
  enabled: true,
  radius: 42,          // px blast radius
  force: 0.012,        // impulse scale to nearby ammo/projectiles
  graceMs: 80,         // ignore collisions in the first 80ms after launch
  maxPerSec: 40,       // rate limit safety cap
  ammoDestroyPct: 0.25 // 25% chance to delete ammo caught in the blast
} as const;

// === Ammo / weapon economy knobs ===

// How many AMMO units a container must collect to trigger its action
export const CONTAINER_CAP = {
  cannon: 100,
  laser: 5,
  missile: 6,
  mortar: 2,
  repair: 250,
  shield: 125,
} as const;

// How much each weapon fires per trigger (or how long it runs)
export const SHOTS_PER_FILL = {
  cannon: 20,         // number of cannon balls
  missile: 8,        // number of missiles
  mortar: 1,         // number of artillery shells
  laserMs: 800,      // milliseconds laser stays on
} as const;

// Damage tuning (integers unless noted)
export const DAMAGE = {
  cannon: 8,         // dmg per cannon ball
  missile: 24,       // dmg per missile (on direct core hit)
  mortar: 22,        // dmg per shell
  laserDps: 40,      // damage per second while laser is on
} as const;

// Shield/repair effects when those bins trigger
export const SHIELD_EFFECT = {
  gain: 20,         // set/raise shield to at least this value
} as const;

export const REPAIR_EFFECT = {
  segmentsToHeal: 3,     // heal this many weakest rim segments
  segHealAmount: 85,     // HP added per healed segment
  centerChance: 0.5,    // chance to also heal center
  centerAmount: 25,       // HP to heal at center when it procs
} as const;

// Visual thickness of the normal rim (when no shield)
export const CORE_RIM_WIDTH_R   = 0.06;  // fraction of core radius

// Visual for the repurposed shield ring (drawn where the outer rim was)
export const SHIELD_RING_WIDTH_R = 0.10; // fraction of core radius
export const SHIELD_RING_GLOW    = 12;   // px of blur
export const SHIELD_RING_COLOR   = 'rgba(120, 200, 255, 0.95)'; // fallback if you don't tint by team

// Core health (starting + max per match)
export const CORE_HP = {
  segments: 100,  // HP for each rim segment
  center:   500,  // HP for the core center
  shieldMax: 50    // for visual normalization of shield ring (not gameplay)
} as const;

// How many rim segments to draw/use (also controls how damage is distributed)
export const CORE_SEGMENTS = 28; // set 8..48; 16–28 looks great

// Where cores sit on the board
export const CORE_POS = {
  xOffsetFrac: 0.16, // fraction of canvas width from midline toward each side (was ~0.22)
  yFrac:       0.55, // fraction of canvas height down from top
  edgeMarginPx: 40,  // safety clamp from edges
};

// How long to show the winner banner, and whether to auto-restart
export const GAMEOVER = {
  bannerMs: 20000,   // 20 seconds
  autoRestart: true, // turn off if you ever want manual restarts only
} as const;

// Mortar launched by angle + speed (per tick), with optional extra gravity
export const MORTAR_ANGLE = {
  angleDeg: 72,        // launch angle above horizontal
  angleJitterDeg: 8,   // random ± jitter
  speedPerTick: 22,    // launch speed in *px per simulation tick*
  speedJitter: 0.12,   // random ± jitter (fraction)
  extraGravity: 0.0    // per-tick^2 downward accel just for mortars (try 0.25–0.45 if arcs too flat)
} as const;


export const PROJECTILE_STYLE = {
  cannon:    { fill: '#FFD24A', glow: '#FFC400' },
  missile:   { fill: '#66CCFF', glow: '#33B5FF' },
  mortar:    { fill: '#FF6B6B', glow: '#FF3B3B' },
  artillery: { fill: '#B4FF6A', glow: '#86FF2D' },
  laser:     { fill: '#FFFFFF', glow: '#88CCFF' }, // beam uses glow only
} as const;

export const PROJECTILE_OUTLINE = '#0B0F1A'; // thin dark ink to separate from ammo

// Fancy laser visuals
export const LASER_FX = {
  beamMs: 600,          // how long the beam stays visible
  innerWidth: 3,        // bright inner core
  outerWidth: 11,       // soft outer glow
  jitterAmp: 6,         // max px offset for the lightning-like jitter
  segments: 12,         // how many jitter points along the line
  dash: 18,             // moving dash length on the core
  flashMs: 140,         // muzzle/impact flash life
  flashSize: 22,        // radius of muzzle/impact flashes
  coreColor: '#FFFFFF', // inner core color
} as const;

// Enable dev hotkeys outside Vite dev (optional)
export const DEV_KEYS = {
  enabledInProd: false
} as const;

// How rim armor interacts with the core
export const ARMOR = {
  // If true, any damage that isn't absorbed by surviving segments goes to the center.
  spillover: true,
  // When both adjacent segments are already 0, multiply full incoming damage by this and apply to center.
  // 1.0 = full passthrough, 0.5 = half, 0.0 = none.
  leakWhenBroken: 1.0,
  // Keep or disable the old random “chip” behavior
  chipChance: 0.0,
} as const;

// Optional: quick debug prints to console for each hit
export const DEBUG_DAMAGE = false;

// End a match after this much wall-clock time.
// Set enabled:false or ms:0 to disable.
export const MATCH_LIMIT = {
  enabled: true,
  ms: 30 * 60 * 1000, // 30 minutes
} as const;

// Global modifier containers & effects
export const GLOBAL_MODS = {
  // container fill caps (per side)
  cap: { buff: 1, debuff: 1 },

  // effect durations
  buffMs:   30_000,   // +damage window
  debuffMs: 30_000,   // disable one weapon window

  // effect strengths
  dmgMultiplier: 2.0,  // x2 damage during buff

  // pool of weapon types eligible for global disable (must exist on both sides)
  debuffable: ['cannon','laser','missile','mortar'] as const,
} as const;



export type BinId =
  | 'cannon' | 'laser' | 'missile' | 'mortar'
  | 'shield' | 'repair' | 'buff' | 'debuff';

export type AmmoKind = 'basic' | 'heavy' | 'volatile' | 'emp' | 'shield' | 'repair';
export type IntakeSide = 'top' | 'bottom' | 'left' | 'right';

export interface BinStyle {
  strokePx?: number;   // optional absolute px (omit to let our default scale)
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
  pos: [number, number];     // FRACTIONS (left side panel): x 0..1 (outer wall→midline), y 0..1 (top→bottom)
  sizeFrac: [number, number]; // FRACTIONS: [wFrac of channel width, hFrac of canvas height]
  intake: IntakeSide;
  rotation?: number;         // degrees
  label?: string;            // default: id
  enabled?: boolean;         // default: true
  style?: BinStyle;
}

// Left-side only; right mirrors automatically
export const BINS_LEFT: Readonly<BinSpec[]> = [
  { id:'cannon',  accepts:['basic','heavy','volatile'], cap:40, pos:[0,0.80], sizeFrac:[0.16,0.025], intake:'top', label:'Cannon', style:{fill:'#480072'} },
  { id:'laser',   accepts:['basic','emp'],              cap:38, pos:[0.45,0.80], sizeFrac:[0.16,0.025], intake:'top', label:'Laser',   style:{fill:'#ff5d5d'} },
  { id:'missile', accepts:['heavy','volatile'],         cap:42, pos:[0.78,0.75], sizeFrac:[0.16,0.025], intake:'top', label:'Missile', style:{fill:'#ffb84d'} },
  { id:'buff',    accepts:['basic','heavy', 'emp','shield','repair'],
                   cap:18, pos:[1.1,0.72], sizeFrac:[0.16,0.025], intake:'top', label:'Buff',    style:{fill:'#5CFF7A'} },

  { id:'mortar',  accepts:['basic','heavy'],            cap:36, pos:[0.25,0.89], sizeFrac:[0.16,0.025], intake:'top', label:'Mortar',  style:{fill:'#bd9cff'} },
  { id:'shield',  accepts:['emp','shield'],             cap:36, pos:[0.60,0.89], sizeFrac:[0.16,0.025], intake:'top', label:'Shield',  style:{fill:'#72f0ff'} },
  { id:'repair',  accepts:['repair', 'heavy'],                   cap:24, pos:[0.95,0.82], sizeFrac:[0.16,0.025], intake:'top', label:'Repair',  style:{fill:'#9cff72'} },
  { id:'debuff',  accepts:['basic','heavy','volatile','emp','shield'],
                   cap:18, pos:[1.35,0.74], sizeFrac:[0.16,0.025], intake:'top', label:'Debuff',  style:{fill:'#FF6B6B'} },
] as const;
