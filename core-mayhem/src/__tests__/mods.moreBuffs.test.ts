import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  applyCooldownBuff,
  currentCooldownMul,
  applyBinBoostBuff,
  currentBinFillMul,
  applyShieldBuff,
  applyRandomBuff,
  currentDmgMul,
} from '../app/mods';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

describe('additional buffs behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSimState();
    // cores for shield buff
    (sim as any).coreL = { shieldHP: 0, shieldHPmax: 200 } as any;
    (sim as any).coreR = { shieldHP: 0, shieldHPmax: 200 } as any;
  });

  it('cooldown buff reduces cooldown multiplier during duration', () => {
    expect(currentCooldownMul(SIDE.LEFT)).toBe(1);
    applyCooldownBuff(SIDE.LEFT, 0.5);
    expect(currentCooldownMul(SIDE.LEFT)).toBeLessThan(1);
    vi.advanceTimersByTime(31_000);
    expect(currentCooldownMul(SIDE.LEFT)).toBe(1);
  });

  it('bin boost increases bin fill multiplier during duration', () => {
    expect(currentBinFillMul(SIDE.RIGHT)).toBe(1);
    applyBinBoostBuff(SIDE.RIGHT, 2.2, 1500);
    expect(currentBinFillMul(SIDE.RIGHT)).toBeGreaterThan(1);
    vi.advanceTimersByTime(2_000);
    expect(currentBinFillMul(SIDE.RIGHT)).toBe(1);
  });

  it('shield buff adds to ablative shield pool', () => {
    expect((sim as any).coreL.shieldHP).toBe(0);
    applyShieldBuff(SIDE.LEFT, 50);
    expect((sim as any).coreL.shieldHP).toBeGreaterThan(0);
  });

  it('random buff selects from pool (damage/shield/binBoost)', () => {
    // pick index 0 → 'damage'
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    applyRandomBuff(SIDE.LEFT);
    expect(currentDmgMul(SIDE.LEFT)).toBeGreaterThan(1);

    // pick index 1 → 'shield'
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    const before = (sim as any).coreR.shieldHP;
    applyRandomBuff(SIDE.RIGHT);
    expect((sim as any).coreR.shieldHP).toBeGreaterThanOrEqual(before);

    // pick index 2 → 'binBoost'
    vi.spyOn(Math, 'random').mockReturnValue(0.8);
    applyRandomBuff(SIDE.LEFT);
    expect(currentBinFillMul(SIDE.LEFT)).toBeGreaterThan(1);
  });
});

