import Matter, { Bodies, World, Events } from 'matter-js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { registerCollisions } from '../app/collisions';
import * as stats from '../app/stats';
import { EXPLOSION } from '../config';
import { useGameplayRandom } from '../sim/rng';
import { tickHoming } from '../sim/weapons';
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
      center: { x: 100, y: 100 },
      segHP: new Array(8).fill(100),
      segHPmax: 100,
      centerHP: 400,
      centerHPmax: 400,
      shieldHP: 0,
      shieldHPmax: 200,
    };
    (sim as any).coreR = {
      center: { x: 540, y: 100 },
      segHP: new Array(8).fill(100),
      segHPmax: 100,
      centerHP: 400,
      centerHPmax: 400,
      shieldHP: 0,
      shieldHPmax: 200,
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
    (cont as any).plugin = {
      kind: 'container',
      accept: ['basic'],
      label: 'cannon',
      side: SIDE.LEFT,
    };

    Matter.Events.trigger(sim.engine as any, 'collisionStart', {
      pairs: [{ bodyA: ammo, bodyB: cont }],
    } as any);

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
    (projA as any).plugin = {
      kind: 'projectile',
      ptype: 'cannon',
      side: SIDE.LEFT,
      dmg: 10,
      spawnT: 0,
    };
    const c0 = (sim as any).coreR.centerHP;
    Matter.Events.trigger(sim.engine as any, 'collisionStart', {
      pairs: [{ bodyA: projA, bodyB: ring }],
    } as any);
    expect((sim as any).coreR.centerHP).toBe(c0); // no core damage
    expect((sim as any).coreR.shieldHP).toBe(40); // shield reduced
    expect(sim.world!.bodies.includes(projA)).toBe(false); // projectile removed

    // Case B: excess penetrates
    (sim as any).coreR.shieldHP = 5;
    const projB = add(Bodies.circle(520, 100, 3));
    (projB as any).plugin = {
      kind: 'projectile',
      ptype: 'cannon',
      side: SIDE.LEFT,
      dmg: 20,
      spawnT: 0,
    };
    const segSum0 = (sim as any).coreR.segHP.reduce((a: number, b: number) => a + b, 0);
    Matter.Events.trigger(sim.engine as any, 'collisionStart', {
      pairs: [{ bodyA: projB, bodyB: ring }],
    } as any);
    const segSum1 = (sim as any).coreR.segHP.reduce((a: number, b: number) => a + b, 0);
    expect(segSum1).toBeLessThan(segSum0);
    det();
  });

  it('projectile ignores weaponMount but explodes on other after grace', () => {
    const det = registerCollisions(sim.engine!);
    const proj = add(Bodies.circle(300, 120, 5));
    (proj as any).plugin = {
      kind: 'projectile',
      ptype: 'missile',
      side: SIDE.LEFT,
      dmg: 10,
      spawnT: performance.now() - 1000,
    };
    const mount = add(Bodies.circle(300, 120, 5, { isSensor: true }));
    (mount as any).plugin = { kind: 'weaponMount', side: SIDE.RIGHT, label: 'laser' };
    const other = add(Bodies.circle(300, 120, 5));
    (other as any).plugin = { kind: 'wall' };

    // collide with weaponMount first → no explosion
    Matter.Events.trigger(sim.engine as any, 'collisionStart', {
      pairs: [{ bodyA: proj, bodyB: mount }],
    } as any);
    expect(sim.world!.bodies.includes(proj)).toBe(true);

    // collide with other → explosion removes projectile and adds FX
    Matter.Events.trigger(sim.engine as any, 'collisionStart', {
      pairs: [{ bodyA: proj, bodyB: other }],
    } as any);
    expect(sim.world!.bodies.includes(proj)).toBe(false);
    expect((sim.fxImp ?? []).length).toBeGreaterThan(0);
    det();
  });
});

describe('collision terminal outcomes', () => {
  beforeEach(() => {
    resetSimState();
    sim.engine = Matter.Engine.create();
    sim.world = sim.engine.world;
    sim.coreR = {
      center: { x: 100, y: 100 },
      segHP: new Array(8).fill(100),
      segHPmax: 100,
      centerHP: 200,
      centerHPmax: 200,
      shieldHP: 0,
      shieldHPmax: 200,
    } as any;
    sim.binsL = { cannon: { fill: 0 } } as any;
    registerCollisions(sim.engine);
  });
  afterEach(() => vi.restoreAllMocks());

  function collide(a: Matter.Body, b: Matter.Body): void {
    Events.trigger(sim.engine!, 'collisionStart', {
      pairs: [
        { bodyA: a, bodyB: b },
        { bodyA: b, bodyB: a },
      ],
    });
  }

  function missile(): Matter.Body {
    const body = Bodies.circle(100, 100, 3);
    body.plugin = {
      kind: 'projectile',
      ptype: 'missile',
      side: SIDE.LEFT,
      dmg: 10,
      spawnT: -10_000,
    };
    World.add(sim.world!, body);
    sim.homing.push(body);
    return body;
  }

  it('deposits one resource once across duplicate and reversed pairs', () => {
    const deposit = vi.spyOn(stats, 'recordBinDeposit');
    const ammo = Bodies.circle(0, 0, 3);
    ammo.plugin = { kind: 'ammo', side: SIDE.LEFT, type: 'basic' };
    const bin = Bodies.rectangle(0, 0, 10, 10);
    bin.plugin = { kind: 'container', side: SIDE.LEFT, accept: ['basic'], label: 'cannon' };
    sim.ammoL = 1;
    World.add(sim.world!, [ammo, bin]);
    collide(ammo, bin);
    collide(ammo, bin);
    expect(sim.ammoL).toBe(0);
    expect(sim.binsL!.cannon.fill).toBe(1);
    expect(deposit).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('records a hit once, even with statistics failure=%s', (fail) => {
    const hit = vi.spyOn(stats, 'recordProjectileHit');
    if (fail)
      hit.mockImplementation(() => {
        throw new Error('stats unavailable');
      });
    const miss = vi.spyOn(stats, 'recordMiss');
    const projectile = missile();
    const core = Bodies.circle(100, 100, 20);
    core.plugin = { kind: 'coreCenter', side: SIDE.RIGHT };
    collide(projectile, core);
    collide(projectile, core);
    tickHoming(16);
    expect(sim.coreR!.centerHP).toBe(190);
    expect(projectile.plugin.didDamage).toBe(true);
    expect(sim.homing).toHaveLength(0);
    expect(hit).toHaveBeenCalledTimes(1);
    expect(miss).not.toHaveBeenCalled();
  });

  it('removes impacted missiles from homing and never counts TTL as a second miss', () => {
    const miss = vi.spyOn(stats, 'recordMiss');
    const projectile = missile();
    collide(projectile, Bodies.rectangle(100, 100, 10, 10));
    tickHoming(16);
    expect(sim.homing).toHaveLength(0);
    expect(miss).toHaveBeenCalledTimes(1);
  });

  it('does not deposit ammo destroyed by an earlier explosion in the event', () => {
    // Explosions roll the seeded gameplay stream, not Math.random.
    const restore = useGameplayRandom(() => 0);
    try {
      const projectile = missile();
      const ammo = Bodies.circle(100, 100, 3);
      ammo.plugin = { kind: 'ammo', side: SIDE.LEFT, type: 'basic' };
      const bin = Bodies.rectangle(100, 100, 10, 10);
      bin.plugin = { kind: 'container', side: SIDE.LEFT, accept: ['basic'], label: 'cannon' };
      World.add(sim.world!, [ammo, bin]);
      sim.ammoL = 1;
      expect(EXPLOSION.ammoDestroyPct).toBeGreaterThan(0);
      Events.trigger(sim.engine!, 'collisionStart', {
        pairs: [
          { bodyA: projectile, bodyB: Bodies.rectangle(100, 100, 10, 10) },
          { bodyA: ammo, bodyB: bin },
        ],
      });
      expect(ammo.plugin.consumed).toBe(true);
      expect(sim.ammoL).toBe(0);
      expect(sim.binsL!.cannon.fill).toBe(0);
    } finally {
      restore();
    }
  });
});
