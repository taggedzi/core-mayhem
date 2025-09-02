import { describe, it, expect, beforeEach } from 'vitest';

import Matter, { Bodies, World, Events } from 'matter-js';
import { registerCollisions } from '../app/collisions';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

describe('collisions: projectile hits shielded core', () => {
  beforeEach(() => {
    resetSimState();
    const eng = Matter.Engine.create();
    sim.world = eng.world;
    sim.engine = eng;

    // minimal core on RIGHT with shield
    (sim as any).coreR = {
      center: { x: 100, y: 100 },
      segHP: new Array(8).fill(100),
      segHPmax: 100,
      centerHP: 200,
      centerHPmax: 200,
      shieldHP: 50,
      shieldHPmax: 200,
    };
    (sim as any).coreL = {
      center: { x: 20, y: 20 },
      segHP: new Array(8).fill(100),
      segHPmax: 100,
      centerHP: 200,
      centerHPmax: 200,
      shieldHP: 0,
      shieldHPmax: 200,
    };

    registerCollisions(eng);
  });

  it('reduces shield and removes projectile', () => {
    const proj = Bodies.circle(100, 100, 3);
    (proj as any).plugin = { kind: 'projectile', ptype: 'cannon', side: SIDE.LEFT, dmg: 10, spawnT: 0 };
    const coreCenter = Bodies.circle(100, 100, 20, { isStatic: true, isSensor: true });
    (coreCenter as any).plugin = { kind: 'coreCenter', side: SIDE.RIGHT };

    World.add(sim.world as any, [proj, coreCenter]);
    const before = sim.world!.bodies.length;
    const shield0 = (sim as any).coreR.shieldHP;

    Events.trigger(sim.engine as any, 'collisionStart', { pairs: [{ bodyA: proj, bodyB: coreCenter }] } as any);

    expect((sim as any).coreR.shieldHP).toBeLessThan(shield0);
    expect(sim.world!.bodies.length).toBeLessThan(before);
    // impact fx queued
    expect((sim as any).fxImp.length).toBeGreaterThan(0);
  });
});

