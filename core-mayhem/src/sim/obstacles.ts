import { Bodies, Body, World, Composite } from 'matter-js';

import { WALL_T } from '../config';
import { PADDLES_LEFT, GELS_LEFT } from '../config';
import { sim } from '../state';

import type { World as MatterWorld } from 'matter-js';

export interface Pipe {
  x: number;
  innerX: number;
  pipeW: number;
  intake: Matter.Body;
  segs: Matter.Body[];
  side: -1 | 1;
}

// Fail-fast guard + narrowing helper (keeps callers simple)
function assertWorld(w: MatterWorld | null): asserts w is MatterWorld {
  if (!w) throw new Error('World not initialized');
}

export function makePipe(side: -1 | 1): Pipe {
  const { W, H } = sim;
  const pipeTop = H * 0.1,
    pipeBottom = H * 0.925;
  const x = side < 0 ? 24 : W - 24;
  const pipeW = Math.max(36, W * 0.036);
  const wallH = pipeBottom - pipeTop;
  const wallY = pipeTop + wallH / 2;
  // solid walls (visualized in draw)
  const leftWall = Bodies.rectangle(x - pipeW / 2 - WALL_T / 2, wallY, WALL_T, wallH, {
    isStatic: true,
  });
  const rightWall = Bodies.rectangle(x + pipeW / 2 + WALL_T / 2, wallY, WALL_T, wallH, {
    isStatic: true,
  });
  (leftWall as any).plugin = { kind: 'pipeWall', side };
  (rightWall as any).plugin = { kind: 'pipeWall', side };
  {
    const w = sim.world;
    assertWorld(w);
    World.add(w, [leftWall, rightWall]);
  }

  // intake
  const intake = Bodies.rectangle(
    x + (side < 0 ? -1 : 1) * (pipeW / 2 + 50),
    pipeBottom - 22,
    110,
    36,
    { isStatic: true, isSensor: true },
  );
  (intake as any).plugin = { kind: 'intake', side, x };
  {
    const w = sim.world;
    assertWorld(w);
    World.add(w, intake);
  }

  // lift segments (sensors that apply a vertical pull)
  const segs: Matter.Body[] = [];
  for (let y = pipeBottom; y > pipeTop; y -= 28) {
    const seg = Bodies.rectangle(x, y, pipeW, 24, { isStatic: true, isSensor: true });
    (seg as any).plugin = { kind: 'lift', side, x, force: 0.006 };
    {
      const w = sim.world;
      assertWorld(w);
      World.add(w, seg);
    }
    segs.push(seg);
  }

  // NEW: x of the *inner* wall face inside the pipe
  const innerX = x + (side < 0 ? +pipeW / 2 : -pipeW / 2);

  return { x, innerX, pipeW, intake, segs, side };
}

export function applyPipeForces(pipes: Pipe[]): void {
  const { H } = sim;
  const w = sim.world;
  assertWorld(w);
  const bodies = Composite.allBodies(w);

  for (const b of bodies) {
    const plug = (b as any).plugin;
    if (!plug || plug.kind !== 'ammo') continue;

    for (const P of pipes) {
      // geometry helpers
      const pipeLeft = P.x - P.pipeW * 0.5 + WALL_T; // inside face
      const pipeRight = P.x + P.pipeW * 0.5 - WALL_T;
      const inY = b.position.y > H * 0.1 && b.position.y < H * 0.925;
      const inX = b.position.x > pipeLeft && b.position.x < pipeRight;
      const inVertical = inX && inY;

      // suction into intake (only if NOT already in the vertical section)
      if (!inVertical) {
        const m = P.intake.bounds;
        if (
          b.position.x > m.min.x &&
          b.position.x < m.max.x &&
          b.position.y > m.min.y &&
          b.position.y < m.max.y
        ) {
          const toward = { x: P.x - b.position.x, y: H * 0.9 - b.position.y };
          const d = Math.hypot(toward.x, toward.y) || 1;
          Body.applyForce(b, b.position, {
            x: (toward.x / d) * 0.004 * b.mass,
            y: (toward.y / d) * 0.004 * b.mass,
          });
        }
      }

      // vertical lift inside pipe: smoothly servo vy toward target
      if (inVertical) {
        const dt = Math.max(0.001, (sim.engine?.timing?.lastDelta ?? 16.6) / 1000);
        const vy = (b as any).velocity?.y ?? b.velocity.y;
        const vx = (b as any).velocity?.x ?? b.velocity.x;
        // Settings no longer define these; read if present at runtime, else defaults
        const upSpeed = (sim as any)?.settings?.pipeUpSpeed ?? 28; // px/s
        const gain = (sim as any)?.settings?.pipeUpGain ?? 3.2; // 1/s
        const vT = -upSpeed; // negative = up

        // Exponential smoothing toward target vy
        const alpha = 1 - Math.exp(-gain * dt); // stable 0..1
        const vyNew = vy + (vT - vy) * alpha;
        Body.setVelocity(b, { x: vx, y: vyNew });

        // gentle centering to avoid rubbing walls
        const dx = P.x - b.position.x;
        Body.applyForce(b, b.position, { x: dx * 0.0008 * b.mass, y: 0 });

        // optional tiny lateral damping (uncomment if they ping-pong)
        // Body.applyForce(b, b.position, { x: -vx * 0.02 * b.mass, y: 0 });
      }
    }
  }
}

export function gelRect(
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { dampX?: number; dampY?: number; kx?: number; ky?: number }, // legacy kx/ky still accepted
): Body {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true, isSensor: true });
  (b as any).plugin = {
    kind: 'gel',
    // prefer new names, fall back to legacy if present
    dampX: opts?.dampX ?? (opts?.kx != null ? opts.kx * 3.0 : 2.0),
    dampY: opts?.dampY ?? (opts?.ky != null ? opts.ky * 3.6 : 3.0),
  };
  {
    const wld = sim.world;
    assertWorld(wld);
    World.add(wld, b);
  }
  sim.gels.push(b);
  return b;
}

export function addPaddle(x: number, y: number, amp: number, spd: number, dir: number): Body {
  const p = Bodies.rectangle(x, y, 80, 8, { isStatic: true, isSensor: true });
  (p as any).plugin = { kind: 'paddle', t: Math.random() * 6, amp, spd, dir };
  {
    const w = sim.world;
    assertWorld(w);
    World.add(w, p);
  }
  sim.paddles.push(p);
  return p;
}

export function tickPaddles(dt: number): void {
  for (const p of sim.paddles) {
    const plug = (p as any).plugin;
    plug.t += dt * plug.spd;
    const phase = Math.sin(plug.t);
    const nx = p.position.x + phase * plug.amp * plug.dir;
    Body.setPosition(p, { x: nx, y: p.position.y });
  }
}

// Push ammo along the bottom toward the edge pipes (gentle outward + tiny lift)
export function conveyorPush(body: Matter.Body): void {
  // stronger outward nudge + a touch more lift to avoid dead-sticking
  const dir = body.position.x < sim.W / 2 ? -1 : 1;
  Body.applyForce(body, body.position, {
    x: dir * 0.0026 * body.mass,
    y: -0.0014 * body.mass,
  });
}

// --- Spec-driven, mirrored placements (modular like bins) ---

function pinsFieldX(side: -1 | 1, pinsMid: number, pinsWidth: number, xFrac: number): number {
  const x0 = pinsMid - pinsWidth / 2;
  const x1 = pinsMid + pinsWidth / 2;
  const xf = side < 0 ? xFrac : 1 - xFrac; // mirror horizontally on right
  return x0 + xf * (x1 - x0);
}

export function placeObstaclesFromSpecs(side: -1 | 1, pinsMid: number, pinsWidth: number): void {
  // Gels
  for (const g of GELS_LEFT) {
    if (g.enabled === false) continue;
    const x = pinsFieldX(side, pinsMid, pinsWidth, g.pos[0]);
    const y = g.pos[1] * sim.H;
    const w = Math.max(4, pinsWidth * g.sizeFrac[0]);
    const h = Math.max(4, sim.H * g.sizeFrac[1]);
    // Omit undefined to satisfy exactOptionalPropertyTypes
    const opts: { dampX?: number; dampY?: number; kx?: number; ky?: number } = {};
    if (g.dampX !== undefined) opts.dampX = g.dampX;
    if (g.dampY !== undefined) opts.dampY = g.dampY;
    gelRect(x, y, w, h, opts);
  }

  // Paddles
  for (const p of PADDLES_LEFT) {
    if (p.enabled === false) continue;
    const x = pinsFieldX(side, pinsMid, pinsWidth, p.pos[0]);
    const y = p.pos[1] * sim.H;
    // Mirror initial direction for the right side so motion is symmetric
    const dir = side < 0 ? p.dir : (p.dir * -1) as -1 | 1;
    addPaddle(x, y, p.amp, p.spd, dir);
  }
}
