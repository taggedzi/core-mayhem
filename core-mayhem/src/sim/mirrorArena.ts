import { Body, Composite } from 'matter-js';

import { sim } from '../state';

/** Reflect physical geometry once; model coordinates share the same transform. */
export function mirrorArena(): void {
  if (!sim.world) return;
  const W = sim.W;
  for (const body of Composite.allBodies(sim.world)) {
    const x = body.position.x;
    const velocity = { x: -body.velocity.x, y: body.velocity.y };
    const angularVelocity = -body.angularVelocity;
    // Reversing winding keeps polygon normals correct, including triangular rotors.
    const vertices = body.vertices.map((v) => ({ x: 2 * x - v.x, y: v.y })).reverse();
    Body.setAngle(body, -body.angle);
    Body.setVertices(body, vertices);
    Body.setPosition(body, { x: W - x, y: body.position.y });
    Body.setVelocity(body, velocity);
    Body.setAngularVelocity(body, angularVelocity);
    body.force.x = -body.force.x;
    body.torque = -body.torque;
    const plugin = body.plugin;
    if (typeof plugin.x0 === 'number') plugin.x0 = W - plugin.x0;
    if (typeof plugin.dir === 'number') plugin.dir = -plugin.dir;
    if (typeof plugin.spinDir === 'number') plugin.spinDir = -plugin.spinDir;
  }
  for (const constraint of Composite.allConstraints(sim.world)) {
    for (const end of ['A', 'B'] as const) {
      const point = constraint[`point${end}`];
      point.x = constraint[`body${end}`] ? -point.x : W - point.x;
      // Matter stores the last body angles for rotating local attachment points.
      const angles = constraint as typeof constraint & { angleA: number; angleB: number };
      angles[`angle${end}`] = -angles[`angle${end}`];
    }
  }
  for (const core of [sim.coreL, sim.coreR]) {
    if (!core) continue;
    core.center.x = W - core.center.x;
    core.rot = -core.rot;
    core.rotSpeed = -core.rotSpeed;
  }
  for (const weapons of [sim.wepL, sim.wepR]) {
    if (!weapons) continue;
    for (const weapon of Object.values(weapons)) weapon.pos.x = W - weapon.pos.x;
  }
  for (const bins of [sim.binsL, sim.binsR]) {
    if (!bins) continue;
    for (const bin of Object.values(bins)) bin.pos.x = W - bin.pos.x;
  }
  for (const pipe of sim.pipes) {
    pipe.x = W - pipe.x;
    pipe.innerX = W - pipe.innerX;
    pipe.side = pipe.side === -1 ? 1 : -1;
  }
}
