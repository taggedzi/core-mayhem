/** FX definitions for visuals and durations. */

/** Simple impact/burn effect durations. */
export const FX_MS = {
  impact: 450, // burst (cannon/missile/mortar)
  burn: 700, // scorch (laser)
} as const;

/** Shield ring visual glow radius. */
export const SHIELD_RING_GLOW = 12;
/** Shield ring stroke color. */
export const SHIELD_RING_COLOR = 'rgba(120, 200, 255, 0.95)';

/** Shield additional VFX (shimmer/sparks). */
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

/** Visual style per projectile type. */
export const PROJECTILE_STYLE = {
  cannon: { fill: '#FFD24A', glow: '#FFC400' },
  missile: { fill: '#66CCFF', glow: '#33B5FF' },
  mortar: { fill: '#FF6B6B', glow: '#FF3B3B' },
  artillery: { fill: '#B4FF6A', glow: '#86FF2D' },
  laser: { fill: '#FFFFFF', glow: '#88CCFF' },
} as const;

/** Projectile outline color for rendering. */
export const PROJECTILE_OUTLINE = '#0B0F1A';

/** Laser beam visuals and timings. */
export const LASER_FX = {
  beamMs: 600,
  innerWidth: 3,
  outerWidth: 11,
  jitterAmp: 6,
  segments: 12,
  dash: 18,
  flashMs: 140,
} as const;

