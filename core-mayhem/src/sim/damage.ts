import { ARMOR, DEBUG_DAMAGE } from '../config';

export type Vec2 = { x:number; y:number };

export function applyCoreDamage(core: any, hitPoint: Vec2, dmgIn: number, angleToSeg: (core:any, p:Vec2)=>{i0:number;i1:number;w0:number;w1:number}) {
  if (!core) return;

  let dmg = Math.max(0, dmgIn);
  if (dmg <= 0) return;

  // If the caller already decided it's a center hit, take the straight path.
  if ((hitPoint as any)._forceCenter) {
    core.centerHP = Math.max(0, core.centerHP - dmg);
    if (DEBUG_DAMAGE) console.log('[DMG] center-only', { dmg, centerHP: core.centerHP });
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

  // If both segments were already broken and there’s *no* arithmetic overflow
  // (because d0Aim/d1Aim were 0 against 0 HP), optionally leak full damage.
  if (overflow <= 1e-6 && h0 <= 0 && h1 <= 0) {
    overflow = dmg * (ARMOR.leakWhenBroken ?? 1.0);
  }

  if (ARMOR.spillover && overflow > 0) {
    core.centerHP = Math.max(0, core.centerHP - overflow);
  } else if ((ARMOR.chipChance ?? 0) > 0 && Math.random() < ARMOR.chipChance) {
    core.centerHP = Math.max(0, core.centerHP - 1);
  }

  if (DEBUG_DAMAGE) {
    console.log('[DMG] rim-hit', {
      dmg,
      segs: [sp.i0, sp.i1],
      segHP_before: [h0, h1],
      applied: [a0, a1],
      overflow,
      centerHP: core.centerHP
    });
  }
}
