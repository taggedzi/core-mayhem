import { Composite, Body } from 'matter-js';

import { sim } from '../state';

import type { World } from 'matter-js';

/**
 * Pure damping gel: while inside a gel AABB, scale velocity by exp(-rate*dt).
 * No buoyancy, no forces. Frame-rate independent.
 * Options stored on the gel body plugin:
 *   dampX: per-second damping rate for vx   (default ~2.0)
 *   dampY: per-second damping rate for vy   (default ~3.0)
 */
export function applyGelForces(): void {
  // Use optional chaining to avoid null engine access
  const dt = (sim.engine?.timing?.lastDelta ?? 16.6) / 1000;
  if (!sim.gels.length) return;

  // Fail-fast world assertion + local capture so TS narrows correctly
  function assertWorld(w: World | null): asserts w is World {
    if (!w) throw new Error('World not initialized');
  }
  const world = sim.world;
  assertWorld(world);

  const bodies = Composite.allBodies(world);
  for (const b of bodies) {
    const plug = (b as any).plugin;
    if (!plug || plug.kind !== 'ammo') continue;

    for (const g of sim.gels) {
      const m = g.bounds;
      if (
        b.position.x > m.min.x &&
        b.position.x < m.max.x &&
        b.position.y > m.min.y &&
        b.position.y < m.max.y
      ) {
        const gp = (g as any).plugin ?? {};
        // Accept new (dampX/dampY) or legacy (kx/ky) options
        const dampX = gp.dampX ?? (gp.kx != null ? gp.kx * 3.0 : 2.0);
        const dampY = gp.dampY ?? (gp.ky != null ? gp.ky * 3.6 : 3.0);

        // frame-rate independent exponential damping
        const sx = Math.exp(-dampX * dt);
        const sy = Math.exp(-dampY * dt);

        Body.setVelocity(b, { x: b.velocity.x * sx, y: b.velocity.y * sy });
      }
    }
  }
}
