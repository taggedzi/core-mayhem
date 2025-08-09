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
  missile:0.75,
  mortar: 0.65,
} as const;

// Simple impact effect durations
export const FX_MS = {
  impact: 450, // burst (cannon/missile/mortar)
  burn:   700, // scorch (laser)
} as const;

// How wide the launcher fans missiles (in degrees)
export const MISSILE_SPREAD_DEG = 40;   // try 26–34 for obvious spread
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
export const SHIELD_DECAY_PER_SEC = 0.35;

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
  laser: 500,
  missile: 1000,
  mortar: 800,
  repair: 500,
  shield: 10,
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
  cannon: 3,         // dmg per cannon ball
  missile: 40,       // dmg per missile (on direct core hit)
  mortar: 55,        // dmg per shell
  laserDps: 40,      // damage per second while laser is on
} as const;

// Shield/repair effects when those bins trigger
export const SHIELD_EFFECT = {
  gain: 2.5,         // set/raise shield to at least this value
} as const;

export const REPAIR_EFFECT = {
  segmentsToHeal: 3,     // heal this many weakest rim segments
  segHealAmount: 65,     // HP added per healed segment
  centerChance: 0.4,    // chance to also heal center
  centerAmount: 12,       // HP to heal at center when it procs
} as const;

// Visual thickness of the normal rim (when no shield)
export const CORE_RIM_WIDTH_R   = 0.06;  // fraction of core radius

// Visual for the repurposed shield ring (drawn where the outer rim was)
export const SHIELD_RING_WIDTH_R = 0.10; // fraction of core radius
export const SHIELD_RING_GLOW    = 12;   // px of blur
export const SHIELD_RING_COLOR   = 'rgba(120, 200, 255, 0.95)'; // fallback if you don't tint by team

// Core health (starting + max per match)
export const CORE_HP = {
  segments: 5,  // HP for each rim segment
  center:   10,  // HP for the core center
  shieldMax: 3    // for visual normalization of shield ring (not gameplay)
} as const;

// How many rim segments to draw/use (also controls how damage is distributed)
export const CORE_SEGMENTS = 20; // set 8..48; 16–28 looks great

// Where cores sit on the board
export const CORE_POS = {
  xOffsetFrac: 0.16, // fraction of canvas width from midline toward each side (was ~0.22)
  yFrac:       0.46, // fraction of canvas height down from top
  edgeMarginPx: 40,  // safety clamp from edges
};

// How long to show the winner banner, and whether to auto-restart
export const GAMEOVER = {
  bannerMs: 20000,   // 20 seconds
  autoRestart: true, // turn off if you ever want manual restarts only
} as const;
