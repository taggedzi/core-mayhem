import { describe, it, expect, beforeEach } from 'vitest';

import { applyCoreDamage } from '../sim/damage';

function mkCore(nSeg = 4): any {
  return {
    segHP: new Array(nSeg).fill(100),
    centerHP: 500,
  } as any;
}

describe('applyCoreDamage', () => {
  let core: any;

  beforeEach(() => {
    core = mkCore(4);
  });

  it('splits across segments with no overflow', () => {
    // Aim exactly between segment 0 and 1, 100 dmg
    const angleMid = (): any => ({ i0: 0, i1: 1, w0: 0.5, w1: 0.5 });
    applyCoreDamage(core, { x: 1, y: 1 }, 100, angleMid as any);
    expect(core.segHP[0]).toBe(50);
    expect(core.segHP[1]).toBe(50);
    expect(core.centerHP).toBe(500);
  });

  it('overflows to center when segment cannot absorb all', () => {
    core.segHP[0] = 10; // weak
    const aimSeg0 = (): any => ({ i0: 0, i1: 1, w0: 1, w1: 0 });
    applyCoreDamage(core, { x: 2, y: 0 }, 100, aimSeg0 as any);
    expect(core.segHP[0]).toBe(0);
    // spillover is enabled in config; 90 should hit center
    expect(core.centerHP).toBe(410);
  });

  it('forces center hit when _forceCenter is set', () => {
    const aimIrrelevant = (): any => ({ i0: 0, i1: 1, w0: 0.2, w1: 0.8 });
    applyCoreDamage(core, { x: 0, y: 0, _forceCenter: true } as any, 42, aimIrrelevant as any);
    expect(core.centerHP).toBe(458);
    // segments unchanged
    expect(core.segHP.every((h: number) => h === 100)).toBe(true);
  });
});
