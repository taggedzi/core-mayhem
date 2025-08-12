import { Events, World } from 'matter-js';

import { sim } from '../state';
import { SIDE, type Side } from '../types';

import { angleToSeg } from './core';

import type { Engine, IEventCollision, World as MatterWorld } from 'matter-js';

function assertEngine(e: Engine | null): asserts e is Engine {
  if (!e) throw new Error('Engine not initialized');
}
function assertWorld(w: MatterWorld | null): asserts w is MatterWorld {
  if (!w) throw new Error('World not initialized');
}
function assertCore(
  c: typeof sim.coreL, // Core | null
): asserts c is NonNullable<typeof sim.coreL> {
  if (!c) throw new Error('Core not initialized');
  if (!Array.isArray((c as any).segHP)) throw new Error('Core.segHP not initialized');
}

export function attachCollisions() {
  const engine = sim.engine;
  assertEngine(engine);
  Events.on(engine, 'collisionStart', (e: IEventCollision<Engine>) => {
    for (const p of e.pairs) {
      const A = p.bodyA as any,
        B = p.bodyB as any;
      const a = A.plugin || {},
        b = B.plugin || {};
      // deposit
      if (a.kind === 'ammo' && b.kind === 'container') deposit(A, B);
      else if (b.kind === 'ammo' && a.kind === 'container') deposit(B, A);
      // core hits
      if (a.kind === 'projectile' && (b.kind === 'coreRing' || b.kind === 'coreCenter')) hit(A, B);
      else if (b.kind === 'projectile' && (a.kind === 'coreRing' || a.kind === 'coreCenter'))
        hit(B, A);
    }
  });
}

function deposit(ammo: any, container: any) {
  const accept = container.plugin.accept as string[];
  if (!accept.includes(ammo.plugin.type)) return;
  const world = sim.world;
  assertWorld(world);
  World.remove(world, ammo);
  if (ammo.plugin.side === SIDE.LEFT) sim.ammoL--;
  else sim.ammoR--;
}

function hit(proj: any, coreBody: any) {
  const side: Side = coreBody.plugin.side;
  const coreMaybe = side === SIDE.LEFT ? sim.coreL : sim.coreR;
  assertCore(coreMaybe);
  const core = coreMaybe;
  const dmg = (proj.plugin.dmg || 8) * (core.shield > 0 ? 0.35 : 1);
  if (coreBody.plugin.kind === 'coreCenter') {
    core.centerHP = Math.max(0, (core.centerHP ?? 0) - dmg);
  } else {
    const sp = angleToSeg(core as any, proj.position);
    const d0 = Math.round(dmg * sp.w0),
      d1 = dmg - d0;
    const segHP = core.segHP as number[];
    segHP[sp.i0] = Math.max(0, (segHP[sp.i0] ?? 0) - d0);
    segHP[sp.i1] = Math.max(0, (segHP[sp.i1] ?? 0) - d1);
  }
  const world = sim.world;
  assertWorld(world);
  World.remove(world, proj);
}
