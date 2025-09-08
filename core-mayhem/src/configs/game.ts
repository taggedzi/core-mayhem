import type { Settings } from '../types';

/** Default simulation settings (seed, spawn, timing). */
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

/** Game-over banner timing and auto-restart. */
export const GAMEOVER = {
  bannerMs: 10000,
  autoRestart: true,
  bannerDelayMs: 800, // delay before showing the winner banner (ms)
} as const;

/** Developer key toggles (dev helpers in prod builds). */
export const DEV_KEYS = {
  enabledInProd: false,
} as const;

/** Armor behavior for damage spillover and chip chance. */
export const ARMOR = {
  spillover: true,
  leakWhenBroken: 1.0,
  chipChance: 0.0,
} as const;

/** Time-limited matches (duration in ms). */
export const MATCH_LIMIT = {
  enabled: true,
  ms: 30 * 60 * 1000,
} as const;

/** Buff/debuff tuning for damage, cooldown, and bin boosts. */
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

