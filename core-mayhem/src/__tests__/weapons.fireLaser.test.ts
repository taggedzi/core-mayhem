import { describe, it, expect, beforeEach } from 'vitest';

import { fireLaser } from '../sim/weapons';
import Matter from 'matter-js';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

describe('weapons.fireLaser', () => {
  beforeEach(() => {
    resetSimState();
    const eng = Matter.Engine.create();
    sim.world = eng.world;
    // ensure arrays exist
    sim.fxBeams = [];
    sim.fxBursts = [];
  });

  it('applies split damage when shield is up and emits FX', () => {
    (sim as any).coreR = {
      center: { x: 100, y: 100 },
      segHP: new Array(10).fill(100),
      centerHP: 500,
      shieldHP: 100,
      shieldHPmax: 200,
    };

    fireLaser(SIDE.LEFT, { x: 0, y: 0 }, { x: 100, y: 100, _forceCenter: true } as any);

    // With default config: DAMAGE.laserDps=40, SHIELD.laserPenetration=0.35
    // => 14 to core
    expect((sim as any).coreR.centerHP).toBe(500 - 14);
    expect(sim.fxBeams!.length).toBeGreaterThan(0);
    expect(sim.fxBursts!.length).toBeGreaterThan(0);
  });
});

