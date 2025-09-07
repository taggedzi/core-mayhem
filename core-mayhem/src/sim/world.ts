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

import { CANVAS } from '../config';
import { sim, resetSimState } from '../state';

// ---------- validators & safe constructors ----------
function validateWorld(world: MatterWorld): void {
  for (const b of world.bodies) {
    if (!b.vertices || b.vertices.length < 3) {
      console.error('Invalid body: too few vertices', describeBody(b));
      return;
    }
    for (const v of b.vertices) {
      if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) {
      console.error('Invalid vertex (NaN/∞):', describeBody(b), v);
      return;
      }
    }
    if (!Number.isFinite(b.area) || b.area <= 0) {
      console.error('Invalid area (<=0 or NaN):', describeBody(b));
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
function scaleToFit(canvas: HTMLCanvasElement): { cssW: number; cssH: number; scale: number } {
  const stage = canvas.parentElement as HTMLElement | null;
  const rect = stage?.getBoundingClientRect();
  let availW = Math.floor(rect?.width ?? 0);
  let availH = Math.floor(rect?.height ?? 0);
  if (availW < 1 || availH < 1) {
    availW = Math.floor(window.innerWidth || 1280);
    availH = Math.floor(window.innerHeight || 720);
  }
  const W0 = CANVAS.width;
  const H0 = CANVAS.height;
  const s = Math.max(1e-3, Math.min(availW / W0, availH / H0));
  const cssW = Math.max(1, Math.floor(W0 * s));
  const cssH = Math.max(1, Math.floor(H0 * s));
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  return { cssW, cssH, scale: s };
}

// Recompute canvas CSS size, backing store, and context transform without
// touching the physics world. Safe to call at any time (even before init).
export function resizeCanvas(canvas: HTMLCanvasElement): void {
  const { cssW, cssH, scale } = scaleToFit(canvas);
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.max(1, Math.floor(cssW * dpr));
  canvas.height = Math.max(1, Math.floor(cssH * dpr));
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  // Keep sim metadata in sync (logical W/H remain fixed)
  sim.dpr = dpr;
}

// ---------- world init ----------
export function initWorld(canvas: HTMLCanvasElement): void {
  resetSimState(sim);

  // Size canvas first (with DPR), then create physics
  resizeCanvas(canvas);

  // Fixed logical world size
  sim.W = CANVAS.width;
  sim.H = CANVAS.height;
  // sim.dpr was set in resizeCanvas

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
