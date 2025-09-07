import Matter, { Bodies, Body, World } from 'matter-js';
import { describe, it, expect, beforeEach } from 'vitest';

import { spawnAmmo, beforeUpdateAmmo } from '../sim/ammo';
import { makePipe, applyPipeForces, tickPaddles, placeObstaclesFromSpecs } from '../sim/obstacles';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

function add(body: Matter.Body) {
  World.add(sim.world as any, body);
  return body;
}

describe('ammo + obstacles behaviors', () => {
  beforeEach(() => {
    resetSimState();
    const eng = Matter.Engine.create();
    sim.engine = eng;
    sim.world = eng.world;
    sim.W = 640 as any;
    sim.H = 360 as any;
  });

  it('spawnAmmo adds ammo and increments side counters with initial velocity', () => {
    const cL0 = sim.ammoL;
    const cR0 = sim.ammoR;
    spawnAmmo(SIDE.LEFT);
    spawnAmmo(SIDE.RIGHT);
    expect(sim.world!.bodies.some((b) => (b as any).plugin?.kind === 'ammo')).toBe(true);
    expect(sim.ammoL).toBe(cL0 + 1);
    expect(sim.ammoR).toBe(cR0 + 1);
    const anyAmmo = sim.world!.bodies.find((b) => (b as any).plugin?.kind === 'ammo')! as any;
    expect(Math.abs(anyAmmo.velocity.x) + Math.abs(anyAmmo.velocity.y)).toBeGreaterThan(0);
  });

  it('beforeUpdateAmmo removes idle ammo after timeout and decrements counters', () => {
    // left ammo placed inside board, zero velocity so idle accumulates
    const a = add(Bodies.circle(200, 200, 5));
    (a as any).plugin = { kind: 'ammo', side: SIDE.LEFT, type: 'basic', age: 0, idle: 0 };
    const c0 = sim.ammoL = 1 as any;
    // advance a large delta to exceed idle > 8s
    sim.engine!.timing.lastDelta = 9000 as any;
    beforeUpdateAmmo();
    expect(sim.world!.bodies.includes(a)).toBe(false);
    expect(sim.ammoL).toBe(c0 - 1);
  });

  it('applyPipeForces suctions near intake and lifts inside vertical', () => {
    const pipeL = makePipe(SIDE.LEFT);
    const pipeR = makePipe(SIDE.RIGHT);
    // near intake region (outside vertical)
    const near = add(Bodies.circle(pipeL.intake.position.x, pipeL.intake.position.y, 5));
    (near as any).plugin = { kind: 'ammo', side: SIDE.LEFT };
    const f0x = (near as any).force.x, f0y = (near as any).force.y;

    // inside vertical region of right pipe (centered x)
    const inside = add(Bodies.circle(pipeR.x, (sim.H * 0.1 + sim.H * 0.925) / 2, 5));
    (inside as any).plugin = { kind: 'ammo', side: SIDE.RIGHT };
    Body.setVelocity(inside, { x: 0, y: 10 }); // downward
    sim.engine!.timing.lastDelta = 50 as any; // 50ms

    applyPipeForces([pipeL, pipeR]);

    // suction applies some non-zero force
    expect((near as any).force.x !== f0x || (near as any).force.y !== f0y).toBe(true);
    // vertical lift should reduce downward speed toward target (may take multiple steps)
    expect((inside as any).velocity.y).toBeLessThan(10);
  });

  it('tickPaddles moves paddles placed from specs', () => {
    // place left-side obstacles (mirrored paddles handled by game elsewhere)
    placeObstaclesFromSpecs(SIDE.LEFT, sim.W * 0.5, sim.W * 0.4);
    expect(sim.paddles.length).toBeGreaterThan(0);
    const p = sim.paddles[0]!;
    const x0 = p.position.x;
    tickPaddles(1.0);
    expect(p.position.x).not.toBe(x0);
  });
});
