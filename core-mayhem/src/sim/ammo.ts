import { Bodies, World, Body, Composite, Sleeping } from 'matter-js';

import { sim } from '../state';
import { SIDE, type Side } from '../types';

import { conveyorPush } from './obstacles';

import type { World as MatterWorld } from 'matter-js';

// Centralized fail-fast guard (keeps callers simple)
function assertWorld(w: MatterWorld | null): asserts w is MatterWorld {
  if (!w) throw new Error('World not initialized');
}

export function spawnAmmo(side: Side) {
  const { W, H } = sim;
  const x = side === SIDE.LEFT ? 30 + Math.random() * 40 : W - 30 - Math.random() * 40;
  const y = H * 0.92 + Math.random() * 10;
  const pool =
    Math.random() < 0.7
      ? ['basic', 'heavy']
      : ['basic', 'heavy', 'volatile', 'emp', 'repair', 'shield'];
  const t = pool[(Math.random() * pool.length) | 0];
  const r = Math.max(3, Math.min(8, Math.round(Math.min(W, H) * 0.006))) + (t === 'heavy' ? 2 : 0);
  const b = Bodies.circle(x, y, r, {
    restitution: 0.6,
    friction: 0.02,
    density: 0.0015,
    sleepThreshold: Infinity, // <-- never sleep
  });
  (b as any).plugin = { kind: 'ammo', side, type: t, age: 0, idle: 0 };
  {
    const world = sim.world;
    assertWorld(world);
    World.add(world, b);
  }
  Body.setVelocity(b, { x: side === SIDE.LEFT ? -1 : +1, y: -1 });
  if (side === SIDE.LEFT) sim.ammoL++;
  else sim.ammoR++;
}

export function beforeUpdateAmmo() {
  const dt = (sim.engine?.timing?.lastDelta ?? 16) / 1000;
  const world = sim.world;
  assertWorld(world);
  const bodies = Composite.allBodies(world);

  for (const b of bodies) {
    const plug = (b as any).plugin;
    if (!plug) continue;
    if (plug.kind === 'ammo') {
      // wake if somehow sleeping (paranoia, engine sleeping is off anyway)
      if ((b as any).isSleeping) Sleeping.set(b, false);
      // bottom conveyors push outwards to pipes
      if (b.position.y > sim.H * 0.915) conveyorPush(b);
      // cleanup so supply refills
      const speed = Math.hypot(b.velocity.x || 0, b.velocity.y || 0);
      plug.age = (plug.age ?? 0) + dt;
      plug.idle = speed < 0.15 ? (plug.idle ?? 0) + dt : 0;

      // micro anti-stall nudge for nearly-still ammo anywhere on the board
      if (speed < 0.02) {
        Body.applyForce(b, b.position, {
          x: (Math.random() - 0.5) * 1e-5 * b.mass,
          y: 1.2e-4 * b.mass,
        });
      }
      if (
        b.position.x < -120 ||
        b.position.x > sim.W + 120 ||
        b.position.y < -120 ||
        b.position.y > sim.H + 20 ||
        plug.idle > 8
      ) {
        World.remove(world, b);
        if (plug.side === SIDE.LEFT) sim.ammoL--;
        else sim.ammoR--;
      }
    }
  }
}
