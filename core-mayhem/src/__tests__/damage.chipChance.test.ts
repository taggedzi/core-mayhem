import { describe, it, expect, vi } from 'vitest';

// Mock config before importing the module under test
vi.mock('../config', async () => {
  const actual = await vi.importActual<any>('../config');
  return {
    ...actual,
    ARMOR: { spillover: false, leakWhenBroken: 1.0, chipChance: 1.0 },
  };
});

import { applyCoreDamage } from '../sim/damage';

describe('applyCoreDamage with chipChance path (mocked config)', () => {
  it('chips center by 1 when spillover is off and chipChance=1', () => {
    const core: any = { segHP: [100, 100], centerHP: 10 };
    // Aim all damage to seg1 with plenty of HP so no spillover occurs
    const aim = (): any => ({ i0: 0, i1: 1, w0: 0, w1: 1 });
    // Math.random is irrelevant since chipChance=1
    const before = core.centerHP;
    applyCoreDamage(core, { x: 0, y: 0 }, 5, aim as any);
    // spillover is false; branch should chip 1
    expect(core.centerHP).toBe(before - 1);
  });
});
