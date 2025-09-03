import Matter from 'matter-js';
import { describe, it, expect, beforeEach } from 'vitest';

import { runSpawn } from '../app/systems/spawn';
import { DEFAULTS } from '../config';
import { sim, resetSimState } from '../state';

describe('runSpawn', () => {
  beforeEach(() => {
    resetSimState();
    const eng = Matter.Engine.create();
    sim.world = eng.world;
    sim.W = 640 as any;
    sim.H = 360 as any;
    (sim as any).settings = { ...DEFAULTS, spawnRate: 100000, targetAmmo: 10 };
    // Large targetAmmo + slow rate to control while-loop
  });

  it('spawns ammo when below soft min and processes accumulator', () => {
    sim.spawnAcc = 2100; // enough for multiple iterations even at slow rate
    sim.ammoL = 0;
    sim.ammoR = 0;
    runSpawn(0);
    // Below softMin ensures double spawn per side; assert some ammo added
    expect(sim.ammoL).toBeGreaterThan(0);
    expect(sim.ammoR).toBeGreaterThan(0);
  });
});

