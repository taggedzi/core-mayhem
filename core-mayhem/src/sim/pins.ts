import { Bodies, World, Constraint, Body } from 'matter-js';

import { PINS } from '../config';
import { sim } from '../state';

interface PinField {
  mid: number;
  width: number;
}

// Fail‑fast guard so callers don't need to remember to pre-check.
function assertWorld(w: World | null): asserts w is World {
  if (!w) throw new Error('World not initialized');
}

export function makePins(side: -1 | 1, opts?: { anchor?: number; gap?: number }): PinField {
  const { W, H } = sim;
  const width = Math.max(10, Math.floor(PINS.width));

  // small breathing room
  const gap = Math.max(0, Math.floor(opts?.gap ?? 12));

  const mid = (() => {
    if (typeof opts?.anchor === 'number') {
      return side < 0 ? opts.anchor + gap + width / 2 : opts.anchor - gap - width / 2;
    }
    // fallback: symmetric fixed mids
    const mL = Math.floor(W * 0.18);
    const mR = W - mL;
    return side < 0 ? mL : mR;
  })();

  // Convert bottom-left startY to canvas Y for first row center
  const startY = Math.max(0, Math.floor(H - PINS.startY));
  const rows = Math.max(1, Math.floor(PINS.rows));
  const sx = Math.max(6, Math.floor(PINS.sx));
  const sy = Math.max(6, Math.floor(PINS.sy));

  const edge = Math.max(0, Math.floor((PINS as any).edgeMargin ?? PINS.pinRadius));
  const left = mid - width / 2 + edge;
  const right = mid + width / 2 - edge;

  for (let r = 0; r < rows; r++) {
    const y = startY + r * sy;
    if ((r + 1) % Math.max(1, PINS.rotorEvery) === 0) {
      // rotors touching both bounds (inclusive spacing)
      const approx = Math.max(2, Math.floor((right - left) / (sx * 1.4)) + 1);
      const cols = Math.max(2, approx);
      const dx = cols > 1 ? (right - left) / (cols - 1) : 0;
      const rad = Math.max(2, Math.floor(PINS.rotorRadius));
      const world = sim.world; // capture for narrowing
      assertWorld(world);
      for (let c = 0; c < cols; c++) {
        const xL = left + c * dx;
        const x = side < 0 ? xL : 2 * mid - xL;
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
      // pins: even rows include both bounds; odd rows offset by half-step
      const approx = Math.max(2, Math.floor((right - left) / sx) + 1);
      const colsEven = Math.max(2, approx);
      const dx = colsEven > 1 ? (right - left) / (colsEven - 1) : 0;
      const world = sim.world; // capture for narrowing
      assertWorld(world);

      if (r % 2 === 0) {
        for (let i = 0; i < colsEven; i++) {
          const xL = left + i * dx;
          const x = side < 0 ? xL : 2 * mid - xL;
          const p = Bodies.circle(x, y, Math.max(2, Math.floor(PINS.pinRadius)), {
            isStatic: true,
            restitution: 0.9,
          });
          (p as any).plugin = { kind: 'pin' };
          World.add(world, p);
        }
      } else {
        const colsOdd = Math.max(1, colsEven - 1);
        const xStart = left + dx / 2;
        for (let i = 0; i < colsOdd; i++) {
          const xL = xStart + i * dx;
          const x = side < 0 ? xL : 2 * mid - xL;
          const p = Bodies.circle(x, y, Math.max(2, Math.floor(PINS.pinRadius)), {
            isStatic: true,
            restitution: 0.9,
          });
          (p as any).plugin = { kind: 'pin' };
          World.add(world, p);
        }
      }
    }
  }
  return { mid, width };
}
