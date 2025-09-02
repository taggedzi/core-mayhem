import { REPAIR_EFFECT } from '../config';
import { sim } from '../state';
import { SIDE, type Side } from '../types';

interface CoreLike {
  segHP: number[];
  segHPmax: number;
  centerHP: number;
  centerHPmax: number;
}

function assertCoreFull(c: any): asserts c is CoreLike {
  if (!c || !Array.isArray(c.segHP)) throw new Error('Core not initialized');
}

export function repair(side: Side): void {
  const coreMaybe = side === SIDE.LEFT ? (sim as any).coreL : (sim as any).coreR;
  assertCoreFull(coreMaybe);
  const core = coreMaybe;
  // heal N weakest segments
  for (let k = 0; k < REPAIR_EFFECT.segmentsToHeal; k++) {
    let idx = 0,
      min = 1e9;
    for (let i = 0; i < core.segHP.length; i++) {
      const hp = core.segHP[i] ?? 0;
      if (hp < min) {
        min = hp;
        idx = i;
      }
    }
    const cur = core.segHP[idx] ?? 0;
    core.segHP[idx] = Math.min(core.segHPmax, cur + REPAIR_EFFECT.segHealAmount);
  }
  // occasional center repair
  if (Math.random() < REPAIR_EFFECT.centerChance) {
    core.centerHP = Math.min(core.centerHPmax, core.centerHP + REPAIR_EFFECT.centerAmount);
  }
}

