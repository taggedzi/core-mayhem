import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../sim/ammo', () => ({ spawnAmmo: vi.fn() }));
import { runSpawn } from '../app/systems/spawn';
import { DEFAULTS } from '../config';
import { spawnAmmo } from '../sim/ammo';
import { resetSimState, sim } from '../state';
import { SIDE } from '../types';

describe('spawn ordering and population boundaries', () => {
  beforeEach(() => {
    resetSimState();
  });
  it.each([
    ['RL', 0, 0, SIDE.RIGHT],
    ['alternateTick', 0, 0, SIDE.LEFT],
    ['alternateTick', 1, 0, SIDE.RIGHT],
    ['alternateMatch', 0, 1, SIDE.LEFT],
    ['alternateMatch', 0, 0, SIDE.RIGHT],
    [undefined, 0, 0, SIDE.LEFT],
  ])('orders %s at tick %s match %s', (mode, tick, match, first) => {
    sim.settings = { ...DEFAULTS, spawnRate: 1, targetAmmo: 10, altOrderMode: mode } as any;
    sim.tick = tick as number;
    sim.matchIndex = match as number;
    sim.ammoL = sim.ammoR = 10;
    runSpawn(1001);
    expect(vi.mocked(spawnAmmo).mock.calls.map((c) => c[0])).toEqual([first, -Number(first)]);
  });
  it('skips full populations and uses default settings when absent', () => {
    sim.settings = undefined as any;
    sim.ammoL = sim.ammoR = 1000000;
    runSpawn(1001);
    expect(spawnAmmo).not.toHaveBeenCalled();
  });
});
