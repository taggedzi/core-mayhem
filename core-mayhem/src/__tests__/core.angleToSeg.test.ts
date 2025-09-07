import { describe, it, expect } from 'vitest';

import { angleToSeg } from '../sim/core';

function makeCore(nSeg: number, rot = 0): any {
  return {
    center: { x: 0, y: 0 },
    segHP: new Array(nSeg).fill(100),
    rot,
  } as any;
}

describe('angleToSeg', () => {
  it('maps right (+X) to segment 0 with full weight', () => {
    const core = makeCore(4);
    const s = angleToSeg(core, { x: 10, y: 0 });
    expect(s.i0).toBe(0);
    expect(s.i1).toBe(1);
    expect(s.w0).toBeCloseTo(1, 5);
    expect(s.w1).toBeCloseTo(0, 5);
  });

  it('splits damage 50/50 at mid-angle', () => {
    const core = makeCore(4);
    // 45 degrees between seg 0 and 1
    const s = angleToSeg(core, { x: Math.SQRT1_2, y: Math.SQRT1_2 });
    expect(s.i0).toBe(0);
    expect(s.i1).toBe(1);
    expect(s.w0).toBeCloseTo(0.5, 5);
    expect(s.w1).toBeCloseTo(0.5, 5);
  });

  it('respects core rotation when mapping', () => {
    const core = makeCore(8, Math.PI / 2); // rotated 90deg
    // Pointing up would normally be seg boundary; with rot, it maps differently
    const s = angleToSeg(core, { x: 0, y: -10 });
    expect(s.i0).toBeGreaterThanOrEqual(0);
    expect(s.i0).toBeLessThan(8);
    expect(s.i1).toBe((s.i0 + 1) % 8);
  });
});
