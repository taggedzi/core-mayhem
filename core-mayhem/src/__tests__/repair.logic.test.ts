import { describe, it, expect, beforeEach, vi } from 'vitest';

import { repair } from '../core/repair';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

describe('repair', () => {
  beforeEach(() => {
    resetSimState();
    (sim as any).coreL = {
      segHP: [10, 20, 30, 40],
      segHPmax: 100,
      centerHP: 100,
      centerHPmax: 200,
    };
  });

  it('heals weakest segments', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1); // prevent center heal path
    repair(SIDE.LEFT);
    // After repair, segment[0] should increase most
    expect((sim as any).coreL.segHP[0]).toBeGreaterThan(10);
    // and segments should not exceed max
    expect((sim as any).coreL.segHP.every((v: number) => v <= 100)).toBe(true);
    ;(Math.random as any).mockRestore?.();
  });

  it('occasionally heals center when random allows', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // force center heal
    const before = (sim as any).coreL.centerHP;
    repair(SIDE.LEFT);
    expect((sim as any).coreL.centerHP).toBeGreaterThan(before);
    ;(Math.random as any).mockRestore?.();
  });
});

