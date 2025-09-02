import { describe, it, expect, beforeEach } from 'vitest';

import Matter, { Bodies, Body, World } from 'matter-js';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';
import { tickHoming } from '../sim/weapons';

function angleOf(vx: number, vy: number): number {
  return Math.atan2(vy, vx);
}

describe('tickHoming', () => {
  beforeEach(() => {
    resetSimState();
    const eng = Matter.Engine.create();
    sim.world = eng.world;
    sim.W = 640 as any;
    sim.H = 360 as any;
    (sim as any).coreL = { center: { x: 100, y: 100 } };
    (sim as any).coreR = { center: { x: 540, y: 100 } };
  });

  it('steers missiles toward the target and accelerates', () => {
    // Left fires toward right core
    const m = Bodies.circle(200, 200, 5);
    (m as any).plugin = { kind: 'projectile', ptype: 'missile', side: SIDE.LEFT, spawnT: performance.now() };
    World.add(sim.world as any, m);
    // initial velocity roughly downward (wrong direction)
    Body.setVelocity(m, { x: 0, y: 1 });
    sim.homing.push(m);

    const desired = angleOf((sim as any).coreR.center.x - m.position.x, (sim as any).coreR.center.y - m.position.y);
    const ang0 = angleOf((m as any).velocity.x, (m as any).velocity.y);
    const sp0 = Math.hypot((m as any).velocity.x, (m as any).velocity.y);

    tickHoming(100); // 100ms tick

    const ang1 = angleOf((m as any).velocity.x, (m as any).velocity.y);
    const sp1 = Math.hypot((m as any).velocity.x, (m as any).velocity.y);

    // should turn closer to desired and increase speed
    const d0 = Math.abs(((desired - ang0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const d1 = Math.abs(((desired - ang1 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    expect(d1).toBeLessThan(d0);
    expect(sp1).toBeGreaterThan(sp0);
  });

  it('removes missiles on TTL expiry', () => {
    const m = Bodies.circle(300, 120, 5);
    (m as any).plugin = { kind: 'projectile', ptype: 'missile', side: SIDE.RIGHT, spawnT: performance.now() - 10_000 };
    World.add(sim.world as any, m);
    sim.homing.push(m);
    const beforeBodies = sim.world!.bodies.length;
    tickHoming(16);
    // either removed from homing (length 0) and likely from world
    expect(sim.homing.length).toBe(0);
    expect(sim.world!.bodies.length).toBeLessThan(beforeBodies);
  });
});

