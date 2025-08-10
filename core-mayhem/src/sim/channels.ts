// src/sim/channels.ts
import { Bodies, World } from 'matter-js';

import { WALL_T, WALL_PHYS_T } from '../config';
import { sim } from '../state';

// Info if you need it later
export interface LanesInfo { lanes: number; gap: number; walls: Matter.Body[] }

/**
 * Build vertical lanes that drop toward the pin field.
 * Each lane has:
 *  - two SOLID side walls (collision on, rendered as single strokes)
 *  - one SENSOR damper slab (no collision) to slow balls
 *
 * Additionally we add ONE tall inner guard wall (closest wall to midline)
 * that extends up toward the top to keep ammo from flooding the cores.
 */
export function buildLanes(mid: number, width: number): LanesInfo {
  const lanes = 4;
  const gap = width / lanes;

  // lane vertical span
  const yTop = sim.H * 0.115; // right below the top bar
  const yBot = sim.H * 0.235; // right above the first pin row
  const cxY = (yTop + yBot) / 2;
  const h = yBot - yTop;

  const walls: Matter.Body[] = [];
  let innerX: number | undefined; // remember the wall nearest the screen midline

  for (let i = 0; i < lanes; i++) {
    const leftX = mid - width / 2 + i * gap;
    const rightX = leftX + gap;

    // two solid side walls (vertical rails)
    const L = Bodies.rectangle(leftX, cxY, WALL_T, h, { isStatic: true });
    const R = Bodies.rectangle(rightX, cxY, WALL_T, h, { isStatic: true });
    (L as any).plugin = { kind: 'laneWall' };
    (R as any).plugin = { kind: 'laneWall' };
    World.add(sim.world, [L, R]);
    walls.push(L, R);

    // remember the wall from this lane that is closer to the screen center
    const near = Math.abs(leftX - sim.W / 2) < Math.abs(rightX - sim.W / 2) ? leftX : rightX;
    if (innerX === undefined || Math.abs(near - sim.W / 2) < Math.abs(innerX - sim.W / 2)) {
      innerX = near;
    }

    // non-blocking damper inside lane (pure velocity damping)
    const slab = Bodies.rectangle((leftX + rightX) / 2, cxY, gap * 0.7, h * 0.92, {
      isStatic: true,
      isSensor: true,
    });
    // Reuse sim.gels for damping regions so existing gel step handles it
    (slab as any).plugin = { kind: 'laneDamp', dampX: 2.0, dampY: 3.0 };
    World.add(sim.world, slab);
    sim.gels.push(slab);
  }

  // Tall inner guard up from near the top UI down to the lane top (yTop)
  if (innerX !== undefined) {
    const topMargin = 0; // Math.max(40, sim.H * 0.06); // keep clear of the title bar
    const tallH = Math.max(60, yTop - topMargin);
    if (tallH > 0) {
      const guard = Bodies.rectangle(innerX, topMargin + tallH / 2, WALL_PHYS_T, tallH, {
        isStatic: true,
      });
      (guard as any).plugin = { kind: 'laneWall' };
      World.add(sim.world, guard);
      walls.push(guard);
    }
  }

  return { lanes, gap, walls };
}
