/** Weapon tuning, firing patterns, homing, and mounts. */

/** Time required to arm a weapon before firing (ms). */
export const WEAPON_WINDUP_MS = 3000;

/** Per-weapon cooldowns (ms). */
export const COOLDOWN_MS = {
  cannon: 1200,
  laser: 900,
  missile: 1600,
  mortar: 1400,
} as const;

/** Scale initial projectile speeds (1 = legacy speed). Lower = slower. */
export const PROJ_SPEED = {
  cannon: 0.8,
  // Slight bump so missiles have a bit more energy off the rail
  missile: 0.75,
} as const;

// How wide the launcher fans missiles (in degrees)
export const MISSILE_SPREAD_DEG = 90; // try 26–34 for obvious spread
export const MISSILE_JITTER_DEG = 20; // random per-missile wobble at launch

/** Tilt the entire missile arc relative to aim-to-target (deg). Negative tilts upward. */
export const MISSILE_ARC_TILT_DEG = -55; // tweak to taste

/** Time between individual missile launches (ms). */
export const MISSILE_STAGGER_MS = 300; // increase to reduce early self-collisions

/** Enable/disable missile homing globally. */
export const HOMING_ENABLED = true;

/** Homing parameters (units per-second for accel/turn). */
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

// Explosions (projectiles pop on any contact + nearby push)
export const EXPLOSION = {
  enabled: true,
  radius: 42,
  force: 0.012,
  graceMs: 80,
  maxPerSec: 40,
  ammoDestroyPct: 0.25,
} as const;

export const DAMAGE = {
  cannon: 3,
  missile: 27,
  mortar: 18,
  laserDps: 40,
} as const;

/** Mortar launch tuning (angle jitter, speed, extra gravity). */
export const MORTAR_ANGLE = {
  angleDeg: 72,
  angleJitterDeg: 6,
  speedPerTick: 22,
  speedJitter: 0.12,
  extraGravity: 0.0,
} as const;

type WeaponId = 'cannon' | 'laser' | 'missile' | 'mortar';

/** Absolute weapon mount points (left side; right mirrors). */
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
