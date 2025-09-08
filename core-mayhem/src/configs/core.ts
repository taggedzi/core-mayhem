/** Core HP, placement, shield, and repair behavior. */

export const CORE_HP = {
  segments: 100,
  center: 500,
  shieldMax: 1200,
} as const;

/** Default number of core boundary segments (can be overridden per match). */
export const CORE_SEGMENTS = 12;

/** Absolute core placement and size (left side; right is mirrored). */
export const CORE = {
  // pos is bottom-left (BL) of the bounding square
  pos: [580, 400] as [number, number],
  radius: 120 as number,
  edgeMarginPx: 40 as number,
} as const;

/** Ablative shield behavior and laser interactions. */
export const SHIELD = {
  startHP: 1200,
  maxHP: 1200,
  onPickup: 60,
  laserPenetration: 0.35,
  laserShieldFactor: 1.2,
} as const;

export const REPAIR_EFFECT = {
  segmentsToHeal: 3,
  segHealAmount: 85,
  centerChance: 0.5,
  centerAmount: 90,
} as const;

