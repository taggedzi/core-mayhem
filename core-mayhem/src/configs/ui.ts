/** Ambient visuals and UI overlay positions. */

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
    sizeMax: 3,
  },
  arcs: {
    enabled: true,
    countPerSide: 2,
    baseR: 193,
    gapPx: 48,
    width: 5,
    alpha: 0.1,
    blur: 0,
  },
} as const;

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

