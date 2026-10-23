import Matter, { Bodies, World, Events } from 'matter-js';
import { describe, it, expect, beforeEach } from 'vitest';

import { registerCollisions } from '../app/collisions';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

describe('collisions: deposit ammo into container', () => {
  let eng: Matter.Engine;
  beforeEach(() => {
    resetSimState();
    eng = Matter.Engine.create();
    sim.world = eng.world;
    sim.engine = eng;
    // minimal bins for left side
    (sim as any).binsL = {
      cannon: { fill: 0, cap: 10 },
    };
    (sim as any).binsR = {
      cannon: { fill: 0, cap: 10 },
    };
    sim.ammoL = 1;
    sim.ammoR = 0;

    registerCollisions(eng);
  });

  it.each([false, true])('handles deposits with gameOver=%s', (gameOver) => {
    sim.gameOver = gameOver;
    const ammo = Bodies.circle(10, 10, 4);
    (ammo as any).plugin = { kind: 'ammo', side: SIDE.LEFT, type: 'basic' };
    const box = Bodies.rectangle(10, 10, 10, 10, { isStatic: true });
    (box as any).plugin = {
      kind: 'container',
      side: SIDE.LEFT,
      accept: ['basic'],
      label: 'cannon',
    };
    World.add(sim.world as any, [ammo, box]);
    const before = sim.world!.bodies.length;

    // trigger deposit collision
    Events.trigger(eng as any, 'collisionStart', { pairs: [{ bodyA: ammo, bodyB: box }] } as any);

    // ammo removed and fill incremented
    expect(sim.world!.bodies.length).toBe(before - (gameOver ? 0 : 1));
    expect((sim as any).binsL.cannon.fill).toBe(gameOver ? 0 : 1);
    expect(sim.ammoL).toBe(gameOver ? 1 : 0);
  });
});
