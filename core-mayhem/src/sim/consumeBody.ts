import { World, type Body } from 'matter-js';

import { sim } from '../state';
import { SIDE } from '../types';

/** Claim a terminal outcome before any fallible effects or statistics callbacks. */
export function consumeBody(body: Body): boolean {
  const plugin = (body.plugin ??= {});
  if (plugin.consumed) return false;
  plugin.consumed = true;
  if (sim.world) World.remove(sim.world, body);
  for (let i = sim.homing.length - 1; i >= 0; i--) {
    if (sim.homing[i] === body) sim.homing.splice(i, 1);
  }
  if (plugin.kind === 'ammo') {
    if (plugin.side === SIDE.LEFT) sim.ammoL = Math.max(0, sim.ammoL - 1);
    else if (plugin.side === SIDE.RIGHT) sim.ammoR = Math.max(0, sim.ammoR - 1);
  }
  return true;
}
