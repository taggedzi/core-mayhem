import { Events, Vector, World } from 'matter-js';

import { sim } from '../state';
import { SIDE, type Side } from '../types';

import { angleToSeg } from './core';

export function attachCollisions() {
  Events.on(sim.engine, 'collisionStart', (e) => {
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
  World.remove(sim.world, ammo);
  if (ammo.plugin.side === SIDE.LEFT) sim.ammoL--;
  else sim.ammoR--;
}

function hit(proj: any, coreBody: any) {
  const side: Side = coreBody.plugin.side;
  const core = side === SIDE.LEFT ? sim.coreL : sim.coreR;
  const dmg = (proj.plugin.dmg || 8) * (core.shield > 0 ? 0.35 : 1);
  if (coreBody.plugin.kind === 'coreCenter') core.centerHP -= dmg;
  else {
    const sp = angleToSeg(core, proj.position);
    const d0 = Math.round(dmg * sp.w0),
      d1 = dmg - d0;
    core.segHP[sp.i0] = Math.max(0, core.segHP[sp.i0] - d0);
    core.segHP[sp.i1] = Math.max(0, core.segHP[sp.i1] - d1);
  }
  World.remove(sim.world, proj);
}
