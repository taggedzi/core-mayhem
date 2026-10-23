import { ARMOR } from '../config';

import { gameplayRandom } from './rng';

interface Vec2 {
  x: number;
  y: number;
}

export function applyCoreDamage(
  core: any,
  hitPoint: Vec2,
  dmgIn: number,
  angleToSeg: (core: any, p: Vec2) => { i0: number; i1: number; w0: number; w1: number },
): void {
  if (!core) return;

  const dmg = Math.max(0, dmgIn);
  if (dmg <= 0) return;

  // If the caller already decided it's a center hit, take the straight path.
  if ((hitPoint as any)._forceCenter) {
    core.centerHP = Math.max(0, core.centerHP - dmg);
    return;
  }

  // Map to the two adjacent rim segments
  const sp = angleToSeg(core, hitPoint);
  const h0 = core.segHP[sp.i0];
  const h1 = core.segHP[sp.i1];

  // Portion of the incoming damage *aimed* at each segment
  const d0Aim = dmg * sp.w0;
  const d1Aim = dmg * sp.w1;

  // What each segment can actually absorb
  const a0 = Math.min(h0, d0Aim);
  const a1 = Math.min(h1, d1Aim);

  // Apply to segments
  core.segHP[sp.i0] = Math.max(0, h0 - a0);
  core.segHP[sp.i1] = Math.max(0, h1 - a1);

  // Overflow that wasn’t absorbed by segments
  let overflow = dmg - (a0 + a1);

  // Both adjacent segments are already broken, so nothing can absorb the hit.
  // leakWhenBroken scales the whole hit into the center (1 keeps a full leak; 0 seals it).
  if (h0 <= 0 && h1 <= 0) {
    overflow = dmg * ARMOR.leakWhenBroken;
  }

  if (ARMOR.spillover && overflow > 0) {
    core.centerHP = Math.max(0, core.centerHP - overflow);
  } else if ((ARMOR.chipChance ?? 0) > 0 && gameplayRandom() < ARMOR.chipChance) {
    core.centerHP = Math.max(0, core.centerHP - 1);
  }
}
