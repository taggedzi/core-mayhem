import { describe, it, expect, beforeEach, vi } from 'vitest';

import * as weapons from '../sim/weapons';
import Matter from 'matter-js';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

describe('weapons queue functions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSimState();
    const eng = Matter.Engine.create();
    sim.world = eng.world;
    // minimal cores so queue functions can resolve targets
    (sim as any).coreL = { center: { x: 100, y: 100 }, shieldHP: 0, shieldHPmax: 0 };
    (sim as any).coreR = { center: { x: 540, y: 100 }, shieldHP: 0, shieldHPmax: 0 };
  });

  it('queueFireMissiles schedules sweep FX and enqueues homing missiles after windup', () => {
    const n0 = (sim.fxSweep ?? []).length;
    const h0 = sim.homing.length;
    weapons.queueFireMissiles(SIDE.LEFT, { x: 50, y: 50 }, 2, 100);
    expect((sim.fxSweep ?? []).length).toBe(n0 + 1); // sweep queued immediately
    // allow windup + per-missile scheduling (100ms each)
    vi.advanceTimersByTime(100 + 2 * 110);
    expect(sim.homing.length).toBeGreaterThan(h0);
  });

  it('queueFireLaser damages the enemy core after windup', () => {
    // Provide segHP for angleToSeg and centerHP for damage
    (sim as any).coreR.segHP = new Array(8).fill(100);
    (sim as any).coreR.centerHP = 200;
    const segSum0 = (sim as any).coreR.segHP.reduce((a: number, b: number) => a + b, 0);
    weapons.queueFireLaser(SIDE.LEFT, { x: 0, y: 0 }, (sim as any).coreR, 50);
    vi.advanceTimersByTime(60);
    const segSum1 = (sim as any).coreR.segHP.reduce((a: number, b: number) => a + b, 0);
    expect(segSum1).toBeLessThan(segSum0);
  });

  it('queueFireCannon adds projectile bodies after windup', () => {
    const before = sim.world!.bodies.length;
    weapons.queueFireCannon(SIDE.RIGHT, { x: 600, y: 100 }, { x: 10, y: 10 }, 2, 80);
    // windup + a little for scheduled burst (first at t=0)
    vi.advanceTimersByTime(200);
    expect(sim.world!.bodies.length).toBeGreaterThan(before);
  });
});
