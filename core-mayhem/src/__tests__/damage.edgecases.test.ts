import { describe, it, expect } from 'vitest';

import { ARMOR } from '../config';
import { applyCoreDamage } from '../sim/damage';

function mkCore(): any {
  return {
    segHP: [0, 0, 0, 0],
    centerHP: 100,
  } as any;
}

describe('applyCoreDamage edge cases', () => {
  it('leaks full damage to center when both segments are broken and no arithmetic overflow', () => {
    const core = mkCore();
    // weights zero → aimed damage is 0 to both segments
    const zeroWeights = (): any => ({ i0: 0, i1: 1, w0: 0, w1: 0 });
    applyCoreDamage(core, { x: 0, y: 0 }, 20, zeroWeights as any);
    // With ARMOR.spillover=true and leakWhenBroken=1, full 20 leaks
    expect(core.centerHP).toBe(80);
  });

  it('scales the center leak by leakWhenBroken when both segments are already broken', () => {
    const armor = ARMOR as { leakWhenBroken: number };
    const prev = armor.leakWhenBroken;
    const zeroWeights = (): any => ({ i0: 0, i1: 1, w0: 0, w1: 0 });
    try {
      armor.leakWhenBroken = 0.5;
      const halved = mkCore();
      applyCoreDamage(halved, { x: 0, y: 0 }, 20, zeroWeights as any);
      expect(halved.centerHP).toBe(90);

      armor.leakWhenBroken = 0;
      const sealed = mkCore();
      applyCoreDamage(sealed, { x: 0, y: 0 }, 20, zeroWeights as any);
      expect(sealed.centerHP).toBe(100);

      // A segment that still has HP absorbs first; the leak factor does not replace that overflow.
      const partial = { segHP: [10, 0, 0, 0], centerHP: 100 };
      const aim = (): any => ({ i0: 0, i1: 1, w0: 1, w1: 0 });
      applyCoreDamage(partial, { x: 0, y: 0 }, 20, aim as any);
      expect(partial.segHP[0]).toBe(0);
      expect(partial.centerHP).toBe(90);
    } finally {
      armor.leakWhenBroken = prev;
    }
  });
});
