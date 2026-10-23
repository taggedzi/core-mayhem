import Matter, { Bodies, World } from 'matter-js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { attachDevHotkeys, isDevModeEnabled, setDevModeEnabled } from '../app/devKeys';
import * as mods from '../app/mods';
import { BINS_LEFT, WEAPON_MOUNTS_LEFT } from '../config';
import * as weapons from '../sim/weapons';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

describe('weapons edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSimState();
    const eng = Matter.Engine.create();
    sim.world = eng.world;
    sim.fxSweep = [];
    sim.fxImp = [];
    sim.homing = [];
    (sim as any).coreL = { center: { x: 100, y: 100 } };
    (sim as any).coreR = { center: { x: 540, y: 100 } };
  });

  it('queue functions no-op when gameOver', () => {
    sim.gameOver = true as any;
    const bodies0 = sim.world!.bodies.length;
    const h0 = sim.homing.length;
    const sweeps0 = (sim.fxSweep ?? []).length;
    weapons.queueFireCannon(SIDE.LEFT, { x: 10, y: 10 }, { x: 20, y: 20 }, 1, 10);
    weapons.queueFireLaser(SIDE.LEFT, { x: 0, y: 0 }, (sim as any).coreR, 10);
    weapons.queueFireMissiles(SIDE.RIGHT, { x: 620, y: 40 }, 1, 10);
    weapons.queueFireMortar(SIDE.RIGHT, { x: 620, y: 40 }, 1, 10);
    vi.advanceTimersByTime(100);
    expect(sim.world!.bodies.length).toBe(bodies0);
    expect(sim.homing.length).toBe(h0);
    expect((sim.fxSweep ?? []).length).toBe(sweeps0);
  });

  it('omits a disabled mount and warns when its bin stays enabled', () => {
    const mount = WEAPON_MOUNTS_LEFT.find((entry) => entry.id === 'cannon');
    const bin = BINS_LEFT.find((entry) => entry.id === 'laser');
    expect(mount && bin).toBeTruthy();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount!.enabled = false;
    try {
      let built = weapons.makeWeapons(SIDE.LEFT);
      expect(built.cannon).toBeUndefined();
      expect(built.laser?.pos).toBeTruthy();
      expect(built.laser?.mount).toBeTruthy();
      expect(
        warn.mock.calls.some((call) => String(call[0]).includes('cannon bin is enabled')),
      ).toBe(true);

      warn.mockClear();
      mount!.enabled = true;
      bin!.enabled = false;
      built = weapons.makeWeapons(SIDE.RIGHT);
      expect(built.laser?.mount).toBeTruthy();
      expect(warn).not.toHaveBeenCalled();
      built = weapons.makeWeapons(SIDE.LEFT);
      expect(built.laser?.mount).toBeTruthy();
      expect(
        warn.mock.calls.some((call) => String(call[0]).includes('laser bin is disabled')),
      ).toBe(true);
    } finally {
      delete mount!.enabled;
      delete bin!.enabled;
      warn.mockRestore();
    }
  });

  it('ignores dev hotkeys for mounts that were not built', () => {
    const wasDev = isDevModeEnabled();
    setDevModeEnabled(true);
    const detach = attachDevHotkeys({ laser: { pos: { x: 1, y: 2 }, mount: {} as never } }, {});
    const press = (key: string): void => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    };
    try {
      expect(() => press('c')).not.toThrow();
      expect(() => press('C')).not.toThrow();
      expect(() => press('m')).not.toThrow();
      expect(() => press('O')).not.toThrow();
    } finally {
      detach();
      setDevModeEnabled(wasDev);
    }
  });

  it('queue functions respect disabled weapons', () => {
    const spy = vi.spyOn(mods, 'isDisabled').mockReturnValue(true);
    const bodies0 = sim.world!.bodies.length;
    weapons.queueFireCannon(SIDE.LEFT, { x: 10, y: 10 }, { x: 20, y: 20 }, 1, 10);
    weapons.queueFireLaser(SIDE.LEFT, { x: 0, y: 0 }, (sim as any).coreR, 10);
    weapons.queueFireMissiles(SIDE.RIGHT, { x: 620, y: 40 }, 1, 10);
    weapons.queueFireMortar(SIDE.RIGHT, { x: 620, y: 40 }, 1, 10);
    vi.advanceTimersByTime(100);
    expect(sim.world!.bodies.length).toBe(bodies0);
    spy.mockRestore();
  });

  it('fireLaser without shield fields applies full base to core (force center)', () => {
    (sim as any).coreR = {
      center: { x: 100, y: 100 },
      segHP: new Array(8).fill(100),
      centerHP: 300,
      // no shieldHP / shieldHPmax
    };
    const before = (sim as any).coreR.centerHP;
    weapons.fireLaser(SIDE.LEFT, { x: 0, y: 0 }, { x: 120, y: 120, _forceCenter: true } as any);
    // default DAMAGE.laserDps * currentDmgMul(LEFT) = 40 * 1 = 40
    expect((sim as any).coreR.centerHP).toBe(before - 40);
  });

  it('tickHoming triggers fuse pop when within radius', async () => {
    // temporarily bump fuse radius
    const { HOMING } = await import('../config');
    (HOMING as any).fuseRadius = 999;
    // missile close to target
    const m = Bodies.circle(520, 100, 5);
    (m as any).plugin = {
      kind: 'projectile',
      ptype: 'missile',
      side: SIDE.LEFT,
      spawnT: performance.now(),
    };
    World.add(sim.world as any, m);
    sim.homing.push(m);
    const beforeBodies = sim.world!.bodies.length;
    weapons.tickHoming(16);
    expect(sim.homing.length).toBe(0);
    expect(sim.world!.bodies.length).toBeLessThan(beforeBodies);
    expect((sim.fxImp ?? []).length).toBeGreaterThan(0);
    // restore fuse radius
    (HOMING as any).fuseRadius = 0;
  });

  it('tickMortarGravity adds gExtra and ignores zero or a missing world', () => {
    const shell = Bodies.circle(100, 100, 6);
    (shell as any).plugin = { kind: 'projectile', ptype: 'mortar', gExtra: 0.2 };
    Matter.Body.setVelocity(shell, { x: 3, y: 0 });
    World.add(sim.world as any, shell);

    const idle = Bodies.circle(140, 100, 6);
    (idle as any).plugin = { kind: 'projectile', ptype: 'mortar', gExtra: 0 };
    Matter.Body.setVelocity(idle, { x: 1, y: 4 });
    World.add(sim.world as any, idle);

    const plain = Bodies.circle(180, 100, 6);
    Matter.Body.setVelocity(plain, { x: 0, y: 2 });
    World.add(sim.world as any, plain);

    const junk = Bodies.circle(220, 100, 6);
    (junk as any).plugin = { gExtra: 'nope' };
    Matter.Body.setVelocity(junk, { x: 0, y: 3 });
    World.add(sim.world as any, junk);

    weapons.tickMortarGravity();
    expect(shell.velocity.y).toBeCloseTo(0.2);
    expect(shell.velocity.x).toBeCloseTo(3);
    expect(idle.velocity.y).toBeCloseTo(4);
    expect(plain.velocity.y).toBeCloseTo(2);
    expect(junk.velocity.y).toBeCloseTo(3);

    (shell as any).plugin.gExtra = -0.1;
    weapons.tickMortarGravity();
    expect(shell.velocity.y).toBeCloseTo(0.1);

    sim.world = null as any;
    expect(() => weapons.tickMortarGravity()).not.toThrow();
  });
});
