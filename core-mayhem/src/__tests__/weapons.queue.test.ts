import Matter from 'matter-js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import * as stats from '../app/stats';
import { advanceFixedSimClock, setFixedSimClock } from '../sim/clock';
import { gameplayRandom, resetGameplayRng } from '../sim/rng';
import * as weapons from '../sim/weapons';
import { cancelWeaponTimers, flushWeaponShots, scheduleWeaponShot } from '../sim/weaponTimers';
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

  afterEach(() => {
    cancelWeaponTimers();
    setFixedSimClock(false);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function queue(kind: string): void {
    const src = { x: 50, y: 50 };
    if (kind === 'cannon') weapons.queueFireCannon(SIDE.LEFT, src, { x: 540, y: 100 }, 4, 100);
    if (kind === 'laser') weapons.queueFireLaser(SIDE.LEFT, src, sim.coreR!, 100);
    if (kind === 'missile') weapons.queueFireMissiles(SIDE.LEFT, src, 4, 100, undefined, 100);
    if (kind === 'mortar') weapons.queueFireMortar(SIDE.LEFT, src, 4, 100);
  }

  it.each(['cannon', 'laser', 'missile', 'mortar'])(
    'cancels %s windup before a restart',
    (kind) => {
      const shot = vi.spyOn(stats, 'recordShotFired');
      const oldWorld = sim.world!;
      const oldCore = sim.coreR!;
      oldCore.segHP = new Array(8).fill(100);
      oldCore.centerHP = 200;
      const before = JSON.stringify(oldCore);
      queue(kind);
      cancelWeaponTimers();
      sim.world = Matter.Engine.create().world;
      sim.gameOver = false;
      vi.advanceTimersByTime(2000);
      expect(oldWorld.bodies).toHaveLength(0);
      expect(sim.world.bodies).toHaveLength(0);
      expect(JSON.stringify(oldCore)).toBe(before);
      expect(shot).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each(['cannon', 'missile', 'mortar'])('cancels remaining %s burst shots', (kind) => {
    queue(kind);
    vi.advanceTimersByTime(110);
    expect(sim.world!.bodies).toHaveLength(1);
    cancelWeaponTimers();
    vi.advanceTimersByTime(2000);
    expect(sim.world!.bodies).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects callbacks when the world changes without explicit cancellation', () => {
    queue('cannon');
    sim.world = Matter.Engine.create().world;
    vi.advanceTimersByTime(2000);
    expect(sim.world.bodies).toHaveLength(0);
  });

  it('fires fixed-clock shots from the sim clock and ignores wall time', () => {
    setFixedSimClock(true);
    queue('cannon');
    vi.advanceTimersByTime(5000);
    expect(sim.world!.bodies).toHaveLength(0);
    advanceFixedSimClock(99);
    flushWeaponShots();
    expect(sim.world!.bodies).toHaveLength(0);
    advanceFixedSimClock(1);
    flushWeaponShots();
    flushWeaponShots();
    expect(sim.world!.bodies.length).toBeGreaterThan(0);
    const fired = sim.world!.bodies.length;
    cancelWeaponTimers();
    advanceFixedSimClock(5000);
    flushWeaponShots();
    expect(sim.world!.bodies).toHaveLength(fired);
  });

  it('keeps the gameplay stream stable when nothing consumes it', () => {
    flushWeaponShots();
    resetGameplayRng(5);
    const first = [gameplayRandom(), gameplayRandom(), gameplayRandom()];
    resetGameplayRng(5);
    Math.random();
    Math.random();
    expect([gameplayRandom(), gameplayRandom(), gameplayRandom()]).toEqual(first);
    advanceFixedSimClock(50);
    expect(gameplayRandom()).toBeTypeOf('number');
  });

  it('drops later fixed-clock shots when an earlier shot cancels the queue', () => {
    setFixedSimClock(true);
    flushWeaponShots();
    let fired = 0;
    scheduleWeaponShot(
      () => {
        fired += 1;
      },
      0,
      () => false,
    );
    advanceFixedSimClock(1);
    flushWeaponShots();
    expect(fired).toBe(0);
    scheduleWeaponShot(
      () => {
        fired += 1;
        cancelWeaponTimers();
      },
      0,
      () => true,
    );
    scheduleWeaponShot(
      () => {
        fired += 1;
      },
      0,
      () => false,
    );
    scheduleWeaponShot(
      () => {
        fired += 1;
      },
      0,
      () => true,
    );
    advanceFixedSimClock(1);
    flushWeaponShots();
    expect(fired).toBe(1);
  });

  it('reset cancels pending shots', () => {
    queue('mortar');
    resetSimState();
    vi.advanceTimersByTime(2000);
    expect(sim.world!.bodies).toHaveLength(0);
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
