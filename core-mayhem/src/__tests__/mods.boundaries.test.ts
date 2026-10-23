import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyBinBoostBuff,
  applyCooldownBuff,
  applyDebuff,
  applyRandomBuff,
  applyShieldBuff,
  currentBinFillMul,
  currentCooldownMul,
  pushBanner,
} from '../app/mods';
import { MODS } from '../config';
import { repair } from '../core/repair';
import { useGameplayRandom } from '../sim/rng';
import { resetSimState, sim } from '../state';
import { SIDE } from '../types';

describe('modifier and state boundaries', () => {
  beforeEach(() => {
    resetSimState();
    vi.spyOn(performance, 'now').mockReturnValue(100);
  });

  it('resets states with absent optional effect arrays', () => {
    const state = { ...sim };
    state.fxBeams = undefined;
    state.fxBursts = undefined;
    state.fxSparks = undefined;
    (state as any).fxBanners = undefined;
    resetSimState(state);
    expect(state.ammoL).toBe(0);
    expect(state.modsR.dmgMul).toBe(1);
  });

  it.each([null, {}, { shieldHP: 5 }, { shieldHPmax: 20 }, { shieldHP: -5, shieldHPmax: 20 }])(
    'handles incomplete shield cores: %j',
    (core) => {
      sim.coreR = core as any;
      const expected = core?.shieldHPmax === 20 ? 10 : (core?.shieldHP ?? 0);
      applyShieldBuff(SIDE.RIGHT, 10);
      if (core) expect((core as any).shieldHP).toBe(expected);
    },
  );

  it('ignores nonpositive shield additions', () => {
    sim.coreL = { shieldHP: 5, shieldHPmax: 20 } as any;
    applyShieldBuff(SIDE.LEFT, -1);
    expect((sim.coreL as any).shieldHP).toBe(5);
  });

  it('uses configured defaults and neutral fallbacks for timed modifiers', () => {
    applyCooldownBuff(SIDE.RIGHT);
    expect(currentCooldownMul(SIDE.RIGHT)).toBeGreaterThanOrEqual(0.2);
    sim.modsR.cooldownMul = undefined;
    expect(currentCooldownMul(SIDE.RIGHT)).toBe(1);
    sim.modsR.buffUntil = undefined;
    expect(currentCooldownMul(SIDE.RIGHT)).toBe(1);
    applyBinBoostBuff(SIDE.RIGHT);
    expect(currentBinFillMul(SIDE.RIGHT)).toBeGreaterThanOrEqual(1);
    sim.modsR.binFillMul = undefined;
    expect(currentBinFillMul(SIDE.RIGHT)).toBe(1);
    sim.modsR.buffUntil = undefined;
    expect(currentBinFillMul(SIDE.RIGHT)).toBe(1);
    (sim as any).fxBanners = undefined;
    pushBanner(SIDE.RIGHT, 'test', { color: 'red', ms: 50 });
    expect(sim.fxBanners!.at(-1)).toMatchObject({ color: 'red', ms: 50 });
  });

  it('falls back to a damage buff and an offline debuff for empty configured pools', () => {
    const buffs = MODS.allowedBuffs;
    const debuffs = MODS.allowedDebuffs;
    try {
      (MODS as any).allowedBuffs = [];
      (MODS as any).allowedDebuffs = [];
      applyRandomBuff(SIDE.RIGHT);
      expect(sim.modsR.buffKind).toBe('damage');
      applyDebuff(SIDE.RIGHT);
      expect(sim.modsR.disabledType).toBeNull();
      (MODS as any).allowedBuffs = undefined;
      applyRandomBuff(SIDE.LEFT);
      expect(sim.modsL.buffKind).toBe('damage');
    } finally {
      (MODS as any).allowedBuffs = buffs;
      (MODS as any).allowedDebuffs = debuffs;
    }
  });

  it('rejects invalid repair cores and repairs missing segment HP on the right', () => {
    sim.coreR = null as any;
    expect(() => repair(SIDE.RIGHT)).toThrow('Core not initialized');
    sim.coreR = {} as any;
    expect(() => repair(SIDE.RIGHT)).toThrow('Core not initialized');
    sim.coreR = { segHP: [undefined], segHPmax: 100, centerHP: 100, centerHPmax: 100 } as any;
    const restore = useGameplayRandom(() => 1);
    repair(SIDE.RIGHT);
    restore();
    expect(sim.coreR!.segHP[0]).toBeGreaterThan(0);
  });
});
