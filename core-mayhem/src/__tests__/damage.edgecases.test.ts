import { describe, it, expect } from 'vitest';

// For the default config branches
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
});
