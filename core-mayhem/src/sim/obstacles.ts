import { Bodies, Body, World, Composite } from 'matter-js';

import { WALL_T } from '../config';
import { PIPES } from '../config';
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
  yTop: number; // canvas y of channel top
  yBottom: number; // canvas y of channel bottom
}

// Fail-fast guard + narrowing helper (keeps callers simple)
function assertWorld(w: MatterWorld | null): asserts w is MatterWorld {
  if (!w) throw new Error('World not initialized');
}

export function makePipe(side: -1 | 1): Pipe {
  const { W, H } = sim;
  // Channel BL and size (left spec, mirrored for right)
  const [cx0, cy0] = PIPES.channel.pos;
  const [cw, ch] = PIPES.channel.size;
  const xBL = side < 0 ? cx0 : W - cx0 - cw;
  const yBL = cy0;
  const xCenter = xBL + cw / 2;
  const yCenter = H - (yBL + ch / 2);
  // solid walls (visualized in draw)
  const leftWall = Bodies.rectangle(xBL - WALL_T / 2, yCenter, WALL_T, ch, {
    isStatic: true,
  });
  const rightWall = Bodies.rectangle(xBL + cw + WALL_T / 2, yCenter, WALL_T, ch, {
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
  // Intake BL and size (left spec, mirrored for right)
  const [ix0, iy0] = PIPES.intake.pos;
  const [iw, ih] = PIPES.intake.size;
  const ixBL = side < 0 ? ix0 : W - ix0 - iw;
  const intake = Bodies.rectangle(ixBL + iw / 2, H - (iy0 + ih / 2), iw, ih, {
    isStatic: true,
    isSensor: true,
  });
  (intake as any).plugin = { kind: 'intake', side };
  {
    const w = sim.world;
    assertWorld(w);
    World.add(w, intake);
  }

  // lift segments (sensors that apply a vertical pull)
  const segs: Matter.Body[] = [];
  for (let y = yBL + ch; y > yBL; y -= 28) {
    const seg = Bodies.rectangle(xCenter, H - y, cw, 24, { isStatic: true, isSensor: true });
    (seg as any).plugin = { kind: 'lift', side, force: 0.006 };
    {
      const w = sim.world;
      assertWorld(w);
      World.add(w, seg);
    }
    segs.push(seg);
  }

  // NEW: x of the *inner* wall face inside the pipe
  const innerX = side < 0 ? xBL + cw : xBL;

  const yTop = H - (yBL + ch);
  const yBottom = H - yBL;
  return { x: xCenter, innerX, pipeW: cw, intake, segs, side, yTop, yBottom };
}

export function applyPipeForces(pipes: Pipe[]): void {
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
      const inY = b.position.y > P.yTop && b.position.y < P.yBottom;
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
          // Pull toward intake center (absolute), no fractional screen math
          const toward = {
            x: P.x - b.position.x,
            y: P.intake.position.y - b.position.y,
          };
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

function gelRect(
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

function addPaddle(x: number, y: number, amp: number, spd: number, dir: number): Body {
  const p = Bodies.rectangle(x, y, 80, 8, { isStatic: true, isSensor: true });
  (p as any).plugin = { kind: 'paddle', t: Math.random() * 6, amp, spd, dir, x0: x };
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
    const spdMul = (sim as any)?.settings?.paddleSpeedMul ?? 1.0;
    const ampMul = (sim as any)?.settings?.paddleAmpMul ?? 1.0;
    plug.t += dt * plug.spd * spdMul;
    const phase = Math.sin(plug.t);
    // Oscillate around original center (no drift) with expanded amplitude
    const x0 = plug.x0 ?? p.position.x;
    const halfW = (p.bounds.max.x - p.bounds.min.x) / 2 || 40;
    const minX = halfW + 4; // soft margin inside edges
    const maxX = sim.W - halfW - 4;
    const maxAmp = Math.max(0, Math.min(x0 - minX, maxX - x0));
    const baseAmp = Math.abs(Number(plug.amp ?? 0)) * ampMul;
    const amp = Math.min(baseAmp, maxAmp);
    let nx = x0 + phase * amp * plug.dir;
    // Bounce at soft margins: flip direction if we would leave the canvas
    if (nx < minX || nx > maxX) {
      plug.dir = (plug.dir * -1) as -1 | 1;
      nx = x0 + phase * amp * plug.dir;
      // Ensure we don't stick just outside; clamp lightly after flip
      nx = Math.max(minX, Math.min(maxX, nx));
    }
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
export function placeObstaclesFromSpecs(side: -1 | 1, _pinsMid: number, _pinsWidth: number): void {
  // Gels (absolute BL pos + size, mirrored horizontally)
  for (const g of GELS_LEFT) {
    if (g.enabled === false) continue;
    const [xBL0, yBL] = g.pos;
    const [w, h] = g.size;
    const xBL = side < 0 ? xBL0 : sim.W - xBL0 - w;
    const cx = xBL + w / 2;
    const cy = sim.H - (yBL + h / 2);
    const opts: { dampX?: number; dampY?: number; kx?: number; ky?: number } = {};
    if (g.dampX !== undefined) opts.dampX = g.dampX;
    if (g.dampY !== undefined) opts.dampY = g.dampY;
    gelRect(cx, cy, w, h, opts);
  }

  // Paddles (absolute BL pos of 80x8 box, mirrored)
  for (const p of PADDLES_LEFT) {
    if (p.enabled === false) continue;
    const [xBL0, yBL] = p.pos;
    const w = 80, h = 8;
    const xBL = side < 0 ? xBL0 : sim.W - xBL0 - w;
    const cx = xBL + w / 2;
    const cy = sim.H - (yBL + h / 2);
    const dir = side < 0 ? p.dir : (p.dir * -1) as -1 | 1;
    addPaddle(cx, cy, p.amp, p.spd, dir);
  }
}
