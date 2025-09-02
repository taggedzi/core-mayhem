import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../sim/weapons', () => ({
  queueFireCannon: vi.fn(),
  queueFireLaser: vi.fn(),
  queueFireMissiles: vi.fn(),
  queueFireMortar: vi.fn(),
}));

vi.mock('../app/mods', () => ({
  applyBuff: vi.fn(),
  applyDebuff: vi.fn(),
}));

vi.mock('../core/repair', () => ({
  repair: vi.fn(),
}));

import { runTriggers } from '../app/systems/triggers';
import * as weapons from '../sim/weapons';
import * as mods from '../app/mods';
import * as repairMod from '../core/repair';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

describe('runTriggers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSimState();
    // Setup core and wep positions
    (sim as any).coreL = { center: { x: 100, y: 100 }, shieldHP: 0, shieldHPmax: 200 };
    (sim as any).coreR = { center: { x: 540, y: 100 }, shieldHP: 0, shieldHPmax: 200 };
    (sim as any).wepL = {
      cannon: { pos: { x: 20, y: 20 } },
      laser: { pos: { x: 25, y: 25 } },
      missile: { pos: { x: 30, y: 30 } },
      mortar: { pos: { x: 35, y: 35 } },
    } as any;
    (sim as any).wepR = {
      cannon: { pos: { x: 620, y: 20 } },
      laser: { pos: { x: 615, y: 25 } },
      missile: { pos: { x: 610, y: 30 } },
      mortar: { pos: { x: 605, y: 35 } },
    } as any;

    // Bins with caps small to trigger easily
    (sim as any).binsL = {
      cannon: { fill: 2, cap: 2 },
      laser: { fill: 2, cap: 2 },
      missile: { fill: 2, cap: 2 },
      mortar: { fill: 2, cap: 2 },
      repair: { fill: 3, cap: 3 },
      shield: { fill: 4, cap: 4 },
      buff: { fill: 1, cap: 1 },
      debuff: { fill: 1, cap: 1 },
    } as any;
    (sim as any).binsR = JSON.parse(JSON.stringify((sim as any).binsL));

    // Cooldowns in past so ready
    const t = performance.now();
    (sim as any).cooldowns = {
      L: { cannon: t - 1, laser: t - 1, missile: t - 1, mortar: t - 1 },
      R: { cannon: t - 1, laser: t - 1, missile: t - 1, mortar: t - 1 },
    };

    // Colors used by triggers (optional)
    document.documentElement.style.setProperty('--left', '#5cf');
    document.documentElement.style.setProperty('--right', '#f76');
  });

  it('fires weapons, applies buffs/debuffs/repair, and shield pickup', () => {
    runTriggers(performance.now());

    expect(weapons.queueFireCannon).toHaveBeenCalled();
    expect(weapons.queueFireLaser).toHaveBeenCalled();
    expect(weapons.queueFireMissiles).toHaveBeenCalled();
    expect(weapons.queueFireMortar).toHaveBeenCalled();

    expect(mods.applyBuff).toHaveBeenCalled();
    expect(mods.applyDebuff).toHaveBeenCalled();
    expect(repairMod.repair).toHaveBeenCalled();

    // Shield pickup increases shieldHP (both sides get processed)
    expect((sim as any).coreL.shieldHP).toBeGreaterThan(0);
    expect((sim as any).coreR.shieldHP).toBeGreaterThan(0);

    // Wind-up FX got appended
    expect((sim as any).fxArm.length).toBeGreaterThanOrEqual(4);
  });
});

