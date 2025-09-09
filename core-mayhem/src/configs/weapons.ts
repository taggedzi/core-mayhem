// core-mayhem/src/configs/weapons.ts

/**
 * Type representing a valid Weapon ID.
 *
 * This type is used to define the possible values for a weapon in the game.
 */
type WeaponId = 'cannon' | 'laser' | 'missile' | 'mortar';

/** Absolute weapon mount points (left side; right mirrors). */
export interface WeaponMountSpec {
  id: WeaponId;
  pos: [number, number]; // bottom-left of bounding circle
  r: number; // radius
  enabled?: boolean;
}

/**
 * Centralized weapon configuration.
 * - Global values live at top-level (e.g. windupMs, cooldownMs).
 * - Per-weapon values grouped under each weapon key.
 * - Missile-specific behavior consolidated under `missile`.
 */
export const WEAPONS = {
  // Time required to arm a weapon before firing (ms).
  windupMs: 3000,

  // Explosions (projectiles pop on any contact + nearby push)
  explosion: {
    enabled: true,
    radius: 42,
    force: 0.012,
    graceMs: 80,
    maxPerSec: 40,
    ammoDestroyPct: 0.25,
  },

  // Per-weapon groupings
  cannon: {
    position: [859, 935],
    display_radius: 5,
    // Scale initial projectile speed (1 = legacy speed). Lower = slower.
    speed: 0.8,
    cooldownMs: 1200,
    damage: 3,
  },

  laser: {
    position: [751, 881],
    display_radius: 5,
    // Laser uses DPS rather than per-projectile damage
    dps: 40,
    cooldownMs: 900,
  },

  missile: {
    position: [643, 827],
    display_radius: 5,
    // Scale initial projectile speed (1 = legacy speed). Lower = slower.
    speed: 0.75, // slightly higher energy off the rail
    cooldownMs: 1600,
    // Launcher behavior
    spreadDeg: 90, // try 26–34 for obvious spread
    jitterDeg: 20, // random per-missile wobble at launch
    // Tilt the entire missile arc relative to aim-to-target (deg). Negative tilts upward.
    arcTiltDeg: -55,
    // Time between individual missile launches (ms). Increase to reduce early self-collisions
    staggerMs: 300,
    // Homing
    homingEnabled: true,
    homing: {
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
    },
    damage: 27,
  },

  mortar: {
    position: [901, 275],
    display_radius: 5,
    damage: 18,
    cooldownMs: 1400,
    // Mortar launch tuning (angle jitter, speed, extra gravity)
    angle: {
      angleDeg: 72,
      angleJitterDeg: 6,
      speedPerTick: 22,
      speedJitter: 0.12,
      extraGravity: 0.0,
    },
  },
} as const;

// Back-compat named exports (non-breaking)
export const WEAPON_WINDUP_MS = WEAPONS.windupMs as number;
export const COOLDOWN_MS = {
  cannon: WEAPONS.cannon.cooldownMs,
  laser: WEAPONS.laser.cooldownMs,
  missile: WEAPONS.missile.cooldownMs,
  mortar: WEAPONS.mortar.cooldownMs,
} as const;

// Maintain the original PROJ_SPEED shape
export const PROJ_SPEED = {
  cannon: WEAPONS.cannon.speed,
  missile: WEAPONS.missile.speed,
} as const;

export const MISSILE_SPREAD_DEG = WEAPONS.missile.spreadDeg;
export const MISSILE_JITTER_DEG = WEAPONS.missile.jitterDeg;
export const MISSILE_ARC_TILT_DEG = WEAPONS.missile.arcTiltDeg;
export const MISSILE_STAGGER_MS = WEAPONS.missile.staggerMs;

export const HOMING_ENABLED = WEAPONS.missile.homingEnabled;
export const HOMING = WEAPONS.missile.homing;

export const EXPLOSION = WEAPONS.explosion;

export const DAMAGE = {
  cannon: WEAPONS.cannon.damage,
  missile: WEAPONS.missile.damage,
  mortar: WEAPONS.mortar.damage,
  laserDps: WEAPONS.laser.dps,
} as const;

export const MORTAR_ANGLE = WEAPONS.mortar.angle;

/**
 * Absolute weapon mount points (left side; right mirrors).
 */
export const WEAPON_MOUNTS_LEFT: readonly WeaponMountSpec[] = [
  {
    id: 'cannon',
    pos: [...WEAPONS.cannon.position],
    r: WEAPONS.cannon.display_radius,
  },
  {
    id: 'laser',
    pos: [...WEAPONS.laser.position],
    r: WEAPONS.laser.display_radius,
  },
  {
    id: 'missile',
    pos: [...WEAPONS.missile.position],
    r: WEAPONS.missile.display_radius,
  },
  {
    id: 'mortar',
    pos: [...WEAPONS.mortar.position],
    r: WEAPONS.mortar.display_radius,
  },
] as const satisfies readonly WeaponMountSpec[];
