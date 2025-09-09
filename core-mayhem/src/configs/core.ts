/** Core placement, HP, shield, and repair behavior (left side; right mirrors). */
export const CORE = {
  // Geometry (bottom-left of bounding square and visual radius)
  pos: [580, 400] as [number, number],
  radius: 120 as number,
  edgeMarginPx: 40 as number,

  // Center HP pool
  hp: 500,

  // Segment configuration
  segments: {
    // HP per boundary segment
    hp: 100,
    // Default boundary segment count (can be overridden per match)
    count: 12,
  },

  // Ablative shield behavior and laser interactions
  shield: {
    startHP: 1200,
    maxHP: 1200,
    onPickup: 60,
    laserPenetration: 0.35,
    laserShieldFactor: 1.2,
  },

  // Repair pulse configuration
  repair: {
    segmentsToHeal: 3,
    segHealAmount: 85,
    centerChance: 0.5,
    centerAmount: 90,
  },
} as const;

// Convenient named exports
export const SHIELD = CORE.shield;
export const REPAIR_EFFECT = CORE.repair;
