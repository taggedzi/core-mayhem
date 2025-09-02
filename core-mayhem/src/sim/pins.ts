import { Bodies, World, Constraint, Body } from 'matter-js';

import { sim } from '../state';

export interface PinField {
  mid: number;
  width: number;
}

// Fail‑fast guard so callers don't need to remember to pre-check.
function assertWorld(w: World | null): asserts w is World {
  if (!w) throw new Error('World not initialized');
}

export function makePins(side: -1 | 1, opts?: { anchor?: number; gap?: number }): PinField {
  const { W, H } = sim;
  const width = W * 0.22;

  // tiny breathing room so balls don’t numerically intersect the pipe wall
  const gap = opts?.gap ?? Math.max(6, W * 0.006);

  const mid =
    opts?.anchor != null
      ? side < 0
        ? opts.anchor + gap + width / 2
        : opts.anchor - gap - width / 2
      : side < 0
        ? W * 0.18
        : W * 0.82;

  const startY = H * 0.235 + 30; // 10px below channel bottom (yBot)
  const rows = 9;
  const sx = Math.max(W * 0.022, 24) * 1.25;
  const sy = Math.max(H * 0.028, 22) * 1.25;

  for (let r = 0; r < rows; r++) {
    if ((r + 1) % 3 === 0) {
      // rotors (mirror x across the field midline for right side)
      const cols = Math.max(3, Math.floor(width / (sx * 1.4)));
      const rad = 12;
      const world = sim.world; // capture for narrowing
      assertWorld(world);
      for (let c = 0; c < cols; c++) {
        const xL = mid - width / 2 + (c + 0.5) * (width / cols);
        const x = side < 0 ? xL : 2 * mid - xL;
        const y = startY + r * sy;
        const poly = Bodies.polygon(x, y, r % 2 ? 3 : 4, rad, {
          friction: 0,
          restitution: 0.12,
          frictionAir: 0.02,
        });
        (poly as any).plugin = { kind: 'rotor', spinDir: Math.random() < 0.5 ? -1 : 1 };
        World.add(world, [
          poly,
          Constraint.create({ pointA: { x, y }, bodyB: poly, length: 0, stiffness: 1 }),
        ]);
        Body.setAngularVelocity(poly, (poly as any).plugin.spinDir * (0.6 + Math.random() * 0.6));
        sim.rotors.push(poly);
      }
    } else {
      // pins (compute left-pattern, then mirror around mid for right)
      const cols = Math.max(6, Math.floor(width / sx));
      const world = sim.world; // capture for narrowing
      assertWorld(world);
      const offsetL = r % 2 ? sx / 2 : 0;
      for (let c = 0; c < cols; c++) {
        const xL = mid - width / 2 + c * sx + offsetL;
        const x = side < 0 ? xL : 2 * mid - xL;
        const y = startY + r * sy;
        const p = Bodies.circle(x, y, 4, { isStatic: true, restitution: 0.9 });
        (p as any).plugin = { kind: 'pin' };
        World.add(world, p);
      }
    }
  }
  return { mid, width };
}
