import Matter, { Bodies, World } from 'matter-js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { registerCollisions } from '../app/collisions';
import { EXPLOSION } from '../config';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

function add(body: Matter.Body): Matter.Body {
  World.add(sim.world as any, body);
  return body;
}

describe('collisions branches', () => {
  const orig = { enabled: EXPLOSION.enabled, maxPerSec: EXPLOSION.maxPerSec, ammoDestroyPct: EXPLOSION.ammoDestroyPct } as any;
  beforeEach(() => {
    resetSimState();
    const eng = Matter.Engine.create();
    sim.engine = eng;
    sim.world = eng.world;
    // cores for hit/asserts
    (sim as any).coreL = { center: { x: 100, y: 100 }, segHP: new Array(8).fill(100), segHPmax: 100, centerHP: 400, centerHPmax: 400, shieldHP: 0, shieldHPmax: 200 };
    (sim as any).coreR = { center: { x: 540, y: 100 }, segHP: new Array(8).fill(100), segHPmax: 100, centerHP: 400, centerHPmax: 400, shieldHP: 0, shieldHPmax: 200 };
  });

  afterEach(() => {
    (EXPLOSION as any).enabled = orig.enabled;
    (EXPLOSION as any).maxPerSec = orig.maxPerSec;
    (EXPLOSION as any).ammoDestroyPct = orig.ammoDestroyPct;
  });

  it('deposit shows binBoost FX when multiplier > 1', () => {
    // Enable binBoost
    (sim as any).modsL = { ...(sim as any).modsL, buffKind: 'binBoost', buffUntil: performance.now() + 10000, binFillMul: 2 };
    (sim as any).binsL = { laser: { fill: 0, cap: 10 } };
    const det = registerCollisions(sim.engine!);
    sim.ammoL = 1 as any;
    const ammo = add(Bodies.circle(0, 0, 3));
    (ammo as any).plugin = { kind: 'ammo', type: 'emp', side: SIDE.LEFT };
    const cont = add(Bodies.rectangle(0, 0, 10, 10));
    (cont as any).plugin = { kind: 'container', accept: ['emp'], label: 'laser', side: SIDE.LEFT };
    Matter.Events.trigger(sim.engine as any, 'collisionStart', { pairs: [{ bodyA: ammo, bodyB: cont }] } as any);
    expect((sim as any).binsL.laser.fill).toBe(2);
    expect(((sim as any).binsL.laser as any)._fxLastAdd).toBe(2);
    expect(((sim as any).binsL.laser as any)._fxT0).toBeGreaterThan(0);
    det();
  });

  it('explosion disabled: no FX added, but projectile still removed', () => {
    (EXPLOSION as any).enabled = false;
    const det = registerCollisions(sim.engine!);
    const proj = add(Bodies.circle(300, 120, 5));
    (proj as any).plugin = { kind: 'projectile', ptype: 'cannon', side: SIDE.LEFT, dmg: 5, spawnT: performance.now() - 1000 };
    const other = add(Bodies.circle(300, 120, 5));
    (other as any).plugin = { kind: 'wall' };
    const fx0 = (sim.fxImp ?? []).length;
    Matter.Events.trigger(sim.engine as any, 'collisionStart', { pairs: [{ bodyA: proj, bodyB: other }] } as any);
    expect(sim.world!.bodies.includes(proj)).toBe(false);
    expect((sim.fxImp ?? []).length).toBe(fx0); // unchanged
    det();
  });

  it('rate limits explosions per second', () => {
    (EXPLOSION as any).enabled = true;
    (EXPLOSION as any).maxPerSec = 0;
    const det = registerCollisions(sim.engine!);
    const makeProj = (): Matter.Body => {
      const p = add(Bodies.circle(310, 120, 5));
      (p as any).plugin = { kind: 'projectile', ptype: 'cannon', side: SIDE.LEFT, dmg: 5, spawnT: performance.now() - 1000 };
      return p;
    };
    const other = add(Bodies.circle(310, 120, 5));
    (other as any).plugin = { kind: 'wall' };
    const fx0 = (sim.fxImp ?? []).length;
    const p1 = makeProj();
    Matter.Events.trigger(sim.engine as any, 'collisionStart', { pairs: [{ bodyA: p1, bodyB: other }] } as any);
    const fx1 = (sim.fxImp ?? []).length;
    const p2 = makeProj();
    Matter.Events.trigger(sim.engine as any, 'collisionStart', { pairs: [{ bodyA: p2, bodyB: other }] } as any);
    const fx2 = (sim.fxImp ?? []).length;
    expect(fx1).toBe(fx0 + 1);
    expect(fx2).toBe(fx1); // second suppressed
    det();
  });

  it('explosion can destroy nearby ammo and decrement ammo counts', () => {
    (EXPLOSION as any).enabled = true;
    (EXPLOSION as any).ammoDestroyPct = 1; // always destroy
    const det = registerCollisions(sim.engine!);
    sim.ammoR = 1 as any;
    const proj = add(Bodies.circle(400, 160, 5));
    (proj as any).plugin = { kind: 'projectile', ptype: 'mortar', side: SIDE.LEFT, dmg: 5, spawnT: performance.now() - 1000 };
    const other = add(Bodies.circle(400, 160, 5));
    (other as any).plugin = { kind: 'wall' };
    const ammo = add(Bodies.circle(400, 160, 3));
    (ammo as any).plugin = { kind: 'ammo', type: 'basic', side: SIDE.RIGHT };
    Matter.Events.trigger(sim.engine as any, 'collisionStart', { pairs: [{ bodyA: proj, bodyB: other }] } as any);
    expect(sim.world!.bodies.includes(ammo)).toBe(false);
    expect(sim.ammoR).toBe(0);
    det();
  });
});
