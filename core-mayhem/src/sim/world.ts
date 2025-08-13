// world.ts
import {
  Engine,
  Runner,
  World,
  Bodies,
  type Body as MatterBody,
  type Bounds,
  type World as MatterWorld,
  type IChamferableBodyDefinition,
  type Vector,
} from 'matter-js';

import { sim, resetSimState } from '../state';

// ---------- validators & safe constructors ----------
function validateWorld(world: MatterWorld): void {
  for (const b of world.bodies) {
    if (!b.vertices || b.vertices.length < 3) {
      console.error('Invalid body: too few vertices', describeBody(b));
      debugger;
      return;
    }
    for (const v of b.vertices) {
      if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) {
        console.error('Invalid vertex (NaN/∞):', describeBody(b), v);
        debugger;
        return;
      }
    }
    if (!Number.isFinite(b.area) || b.area <= 0) {
      console.error('Invalid area (<=0 or NaN):', describeBody(b));
      debugger;
      return;
    }
  }
}

interface BodySummary {
  id: number;
  label: string;
  parts: number;
  position: Vector;
  bounds: Bounds;
  area: number;
}

function describeBody(b: MatterBody): BodySummary {
  return {
    id: b.id,
    label: b.label,
    parts: b.parts?.length,
    position: b.position,
    bounds: b.bounds,
    area: b.area,
  };
}

function safeRect(
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: IChamferableBodyDefinition & { label?: string },
): MatterBody {
  if (![x, y, w, h].every(Number.isFinite)) {
    throw new Error(`NaN rect param for ${opts?.label ?? 'rect'}`);
  }
  // avoid zero/negative dimensions
  w = Math.max(1, Math.abs(w));
  h = Math.max(1, Math.abs(h));
  return Bodies.rectangle(x, y, w, h, opts);
}

// ---------- sizing ----------
function fit16x9(canvas: HTMLCanvasElement): { w: number; h: number } {
  const stage = canvas.parentElement as HTMLElement | null;
  const rect = stage?.getBoundingClientRect();

  // Prefer real layout box; fall back to window if stage not laid out yet
  let availW = Math.floor(rect?.width ?? 0);
  let availH = Math.floor(rect?.height ?? 0);
  if (availW < 1 || availH < 1) {
    availW = Math.floor(window.innerWidth || 1280);
    availH = Math.floor(window.innerHeight || 720);
  }

  const target = 16 / 9;
  let w = Math.floor(availW);
  let h = Math.floor(w / target);
  if (h > availH) {
    h = Math.floor(availH);
    w = Math.floor(h * target);
  }

  // clamp to ≥1px to avoid zero-sized bodies
  w = Math.max(1, w);
  h = Math.max(1, h);

  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  return { w, h };
}

// ---------- world init ----------
export function initWorld(canvas: HTMLCanvasElement): void {
  resetSimState(sim);

  // Size canvas first (with DPR), then create physics
  const { w: cssW, h: cssH } = fit16x9(canvas);
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.max(1, Math.floor(cssW * dpr));
  canvas.height = Math.max(1, Math.floor(cssH * dpr));
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  sim.W = cssW;
  sim.H = cssH;
  sim.dpr = dpr;

  // Create ONE engine, store it, then configure
  const engine = Engine.create({ enableSleeping: false });
  engine.positionIterations = 8;
  engine.velocityIterations = 6;
  engine.gravity.y = 0.9; // soft gravity — projectiles are driven manually

  sim.engine = engine;
  sim.world = engine.world;

  // --- world bounds using safeRect (prevents 0-width/height) ---
  const walls = [
    safeRect(sim.W / 2, sim.H + 40, sim.W, 80, { isStatic: true, label: 'floor' }),
    safeRect(-40, sim.H / 2, 80, sim.H, { isStatic: true, label: 'left-wall' }),
    safeRect(sim.W + 40, sim.H / 2, 80, sim.H, { isStatic: true, label: 'right-wall' }),
    safeRect(sim.W / 2, -40, sim.W, 80, { isStatic: true, label: 'ceiling' }),
  ];
  World.add(sim.world, walls);

  // Validate BEFORE starting the runner so errors point to the bad body
  validateWorld(sim.world);

  // Start the runner exactly once, with the same engine
  sim.runner = Runner.create();
  Runner.run(sim.runner, engine);
}

export function clearWorld(): void {
  if (sim.runner) Runner.stop(sim.runner);
  if (sim.engine) {
    World.clear(sim.engine.world, false);
    Engine.clear(sim.engine);
  }

  // guard against undefined arrays
  (sim.gels ||= []).length = 0;
  (sim.paddles ||= []).length = 0;
  (sim.flippers ||= []).length = 0;
  (sim.rotors ||= []).length = 0;
  (sim.pipes ||= []).length = 0;

  sim.ammoL = 0;
  sim.ammoR = 0;
  sim.spawnAcc = 0;
}
