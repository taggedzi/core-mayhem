import Matter, { Bodies, World } from 'matter-js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { registerCollisions } from '../app/collisions';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

function add(body: Matter.Body): Matter.Body {
  const w = sim.world as Matter.World;
  World.add(w, body);
  return body;
}

describe('collisions edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSimState();
    const eng = Matter.Engine.create();
    sim.engine = eng;
    sim.world = eng.world;
    // setup minimal cores matching assertCoreFull
    (sim as any).coreL = {
      center: { x: 100, y: 100 }, segHP: new Array(8).fill(100), segHPmax: 100,
      centerHP: 400, centerHPmax: 400, shieldHP: 0, shieldHPmax: 200,
    };
    (sim as any).coreR = {
      center: { x: 540, y: 100 }, segHP: new Array(8).fill(100), segHPmax: 100,
      centerHP: 400, centerHPmax: 400, shieldHP: 0, shieldHPmax: 200,
    };

    // bins used by deposit; simple shape with cannon
    (sim as any).binsL = { cannon: { fill: 0, cap: 10 } };
    (sim as any).binsR = { cannon: { fill: 0, cap: 10 } };
  });

  it('deposits ammo into container and increments bin fill', () => {
    const det = registerCollisions(sim.engine!);
    sim.ammoL = 1 as any;
    const ammo = add(Bodies.circle(0, 0, 3));
    (ammo as any).plugin = { kind: 'ammo', type: 'basic', side: SIDE.LEFT };
    const cont = add(Bodies.rectangle(0, 0, 10, 10));
    (cont as any).plugin = { kind: 'container', accept: ['basic'], label: 'cannon', side: SIDE.LEFT };

    Matter.Events.trigger(sim.engine as any, 'collisionStart', { pairs: [{ bodyA: ammo, bodyB: cont }] } as any);

    // body removed and bin incremented
    expect(sim.world!.bodies.includes(ammo)).toBe(false);
    expect((sim as any).binsL.cannon.fill).toBe(1);
    expect(sim.ammoL).toBe(0);
    det();
  });

  it('projectile hitting shield fully absorbed vs excess', () => {
    const det = registerCollisions(sim.engine!);
    // target is right side core ring
    const ring = add(Bodies.circle(540, 100, 20, { isSensor: true }));
    (ring as any).plugin = { kind: 'coreRing', side: SIDE.RIGHT };

    // Case A: fully absorbed by shield
    (sim as any).coreR.shieldHP = 50;
    const projA = add(Bodies.circle(520, 100, 3));
    (projA as any).plugin = { kind: 'projectile', ptype: 'cannon', side: SIDE.LEFT, dmg: 10, spawnT: 0 };
    const c0 = (sim as any).coreR.centerHP;
    Matter.Events.trigger(sim.engine as any, 'collisionStart', { pairs: [{ bodyA: projA, bodyB: ring }] } as any);
    expect((sim as any).coreR.centerHP).toBe(c0); // no core damage
    expect((sim as any).coreR.shieldHP).toBe(40); // shield reduced
    expect(sim.world!.bodies.includes(projA)).toBe(false); // projectile removed

    // Case B: excess penetrates
    (sim as any).coreR.shieldHP = 5;
    const projB = add(Bodies.circle(520, 100, 3));
    (projB as any).plugin = { kind: 'projectile', ptype: 'cannon', side: SIDE.LEFT, dmg: 20, spawnT: 0 };
    const segSum0 = (sim as any).coreR.segHP.reduce((a: number, b: number) => a + b, 0);
    Matter.Events.trigger(sim.engine as any, 'collisionStart', { pairs: [{ bodyA: projB, bodyB: ring }] } as any);
    const segSum1 = (sim as any).coreR.segHP.reduce((a: number, b: number) => a + b, 0);
    expect(segSum1).toBeLessThan(segSum0);
    det();
  });

  it('projectile ignores weaponMount but explodes on other after grace', () => {
    const det = registerCollisions(sim.engine!);
    const proj = add(Bodies.circle(300, 120, 5));
    (proj as any).plugin = { kind: 'projectile', ptype: 'missile', side: SIDE.LEFT, dmg: 10, spawnT: performance.now() - 1000 };
    const mount = add(Bodies.circle(300, 120, 5, { isSensor: true }));
    (mount as any).plugin = { kind: 'weaponMount', side: SIDE.RIGHT, label: 'laser' };
    const other = add(Bodies.circle(300, 120, 5));
    (other as any).plugin = { kind: 'wall' };

    // collide with weaponMount first → no explosion
    Matter.Events.trigger(sim.engine as any, 'collisionStart', { pairs: [{ bodyA: proj, bodyB: mount }] } as any);
    expect(sim.world!.bodies.includes(proj)).toBe(true);

    // collide with other → explosion removes projectile and adds FX
    Matter.Events.trigger(sim.engine as any, 'collisionStart', { pairs: [{ bodyA: proj, bodyB: other }] } as any);
    expect(sim.world!.bodies.includes(proj)).toBe(false);
    expect((sim.fxImp ?? []).length).toBeGreaterThan(0);
    det();
  });
});
