import { describe, it, expect, beforeEach, vi } from 'vitest';

import { currentDmgMul, isDisabled, applyBuff, applyDebuff } from '../app/mods';
import { resetSimState } from '../state';
import { SIDE } from '../types';

describe('mods logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSimState();
  });

  it('applyBuff temporarily increases damage multiplier', () => {
    expect(currentDmgMul(SIDE.LEFT)).toBe(1);
    applyBuff(SIDE.LEFT);
    expect(currentDmgMul(SIDE.LEFT)).toBeGreaterThan(1);
    vi.advanceTimersByTime(31_000); // past default duration
    expect(currentDmgMul(SIDE.LEFT)).toBe(1);
  });

  it('applyDebuff disables a weapon kind for a duration', () => {
    expect(isDisabled(SIDE.RIGHT, 'cannon')).toBe(false);
    applyDebuff(SIDE.RIGHT, 'cannon');
    expect(isDisabled(SIDE.RIGHT, 'cannon')).toBe(true);
    vi.advanceTimersByTime(31_000);
    expect(isDisabled(SIDE.RIGHT, 'cannon')).toBe(false);
  });
});
