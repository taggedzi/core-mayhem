import { Bodies, Body, Composite, Constraint, Engine, World } from 'matter-js';
import { beforeEach, describe, expect, it } from 'vitest';

import { makeBins } from '../sim/containers';
import { mirrorArena } from '../sim/mirrorArena';
import { applyPipeForces, makePipe, tickPaddles } from '../sim/obstacles';
import { resetSimState, sim } from '../state';
import { SIDE } from '../types';

describe('arena reflection with real Matter geometry', () => {
  beforeEach(() => {
    resetSimState();
    sim.engine = Engine.create();
    sim.world = sim.engine.world;
    sim.W = 1920;
    sim.H = 1080;
  });

  it('keeps bin models aligned with shared world sensors', () => {
    sim.binsL = makeBins(SIDE.LEFT);
    const before = Object.values(sim.binsL!).map((b) => ({
      bin: b,
      x: b.pos.x,
      boxX: b.box.position.x,
      intakeX: b.intake.position.x,
    }));
    mirrorArena();
    for (const { bin, x, boxX, intakeX } of before) {
      expect(bin.pos.x).toBeCloseTo(sim.W - x);
      expect(bin.box.position.x).toBeCloseTo(sim.W - boxX);
      expect(bin.intake.position.x).toBeCloseTo(sim.W - intakeX);
    }
  });

  it('reflects rotor vertices, velocities and anchors and preserves them through engine updates', () => {
    const rotor = Bodies.polygon(200, 100, 3, 20);
    Body.setAngle(rotor, 0.3);
    const points = rotor.vertices.map((v) => ({ x: sim.W - v.x, y: v.y }));
    const anchor = Constraint.create({
      pointA: { x: 200, y: 100 },
      bodyB: rotor,
      length: 0,
      stiffness: 1,
    });
    World.add(sim.world!, [rotor, anchor]);
    mirrorArena();
    expect(anchor.pointA.x).toBe(1720);
    for (const point of points)
      expect(rotor.vertices.some((v) => Math.hypot(v.x - point.x, v.y - point.y) < 1e-6)).toBe(
        true,
      );
    for (let i = 0; i < 10; i++) Engine.update(sim.engine!, 1000 / 60);
    expect(rotor.position.x).toBeCloseTo(anchor.pointA.x, 4);
  });

  it('reflects paddle trajectories and pipe forces', () => {
    const paddle = Bodies.rectangle(400, 300, 80, 8, { isStatic: true });
    paddle.plugin = { x0: 400, t: 0, spd: 1, amp: 60, dir: 1 };
    World.add(sim.world!, paddle);
    sim.paddles.push(paddle);
    const pipe = makePipe(-1);
    sim.pipes.push(pipe);
    const oldPipeX = pipe.x;
    const oldInnerX = pipe.innerX;
    mirrorArena();
    tickPaddles(0.5);
    expect(paddle.position.x).toBeCloseTo(sim.W - (400 + Math.sin(0.5) * 60));
    expect(pipe.x).toBeCloseTo(sim.W - oldPipeX);
    expect(pipe.innerX).toBeCloseTo(sim.W - oldInnerX);
    const ammo = Bodies.circle(pipe.x + 1, (pipe.yTop + pipe.yBottom) / 2, 3);
    ammo.plugin = { kind: 'ammo' };
    World.add(sim.world!, ammo);
    applyPipeForces(sim.pipes);
    expect(ammo.velocity.y).toBeLessThan(0);
    expect(ammo.force.x).toBeLessThan(0);
  });

  it('reflecting twice restores positions and constraint endpoints', () => {
    const body = Bodies.rectangle(200, 300, 20, 10);
    Body.setVelocity(body, { x: 2, y: 3 });
    const anchor = Constraint.create({
      bodyA: body,
      pointA: { x: 5, y: 2 },
      pointB: { x: 200, y: 300 },
    });
    World.add(sim.world!, [body, anchor]);
    mirrorArena();
    mirrorArena();
    expect(Composite.allBodies(sim.world!)[0]!.position.x).toBeCloseTo(200);
    expect(body.velocity.x).toBeCloseTo(2);
    expect(anchor.pointA.x).toBe(5);
    expect(anchor.pointB.x).toBe(200);
  });
});
