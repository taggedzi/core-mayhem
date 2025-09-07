import { Bodies, Body, World } from 'matter-js';

import { BIN_INTAKE_H, BINS_LEFT, type BinSpec, type IntakeSide } from '../config';
import { sim } from '../state';
import { SIDE, type Side } from '../types';

/**
 * Nudge all bins on a side so they stay at least `margin` px away from that side's
 * pipe inner wall (uses sim.pipes[0|1].innerX; no world scanning).
 * Safe no-op if something isn’t ready.
 */
export function nudgeBinsFromPipes(side: Side, bins: any, margin = 5): void {
  if (!bins || !sim.pipes) return;
  const pipe = side === SIDE.LEFT ? sim.pipes[0] : sim.pipes[1];
  const innerX = (pipe as any)?.innerX;
  if (typeof innerX !== 'number' || Number.isNaN(innerX)) return;

  const isLeft = side === SIDE.LEFT;
  const safeEdgeX = isLeft ? innerX + margin : innerX - margin;

  const shiftIfNeeded = (bin: any): void => {
    const wall = bin?.box ?? bin?.body ?? bin?.intake;
    if (!wall?.bounds) return;

    const bw = wall.bounds.max.x - wall.bounds.min.x;
    const half = bw * 0.5;
    const cx = wall.position.x;
    let nx = cx;

    if (isLeft) {
      if (cx - half < safeEdgeX) nx = safeEdgeX + half;
    } else {
      if (cx + half > safeEdgeX) nx = safeEdgeX - half;
    }

    if (nx !== cx && Number.isFinite(nx)) {
      // move everything tied to this bin
      if (bin.box) Body.setPosition(bin.box, { x: nx, y: bin.box.position.y });
      if (bin.intake) Body.setPosition(bin.intake, { x: nx, y: bin.intake.position.y });
      if (bin.pos) bin.pos.x = nx;
    }
  };

  Object.values(bins as Record<string, any>).forEach(shiftIfNeeded);
}

// No longer used (absolute placement model)

interface Offset {
  dx: number;
  dy: number;
  iw: number;
  ih: number;
}

function intakeOffset(intake: IntakeSide, w: number, h: number): Offset {
  const ih = Math.round(BIN_INTAKE_H);
  const iwTB = Math.max(12, Math.round(w * 0.92));
  const iwLR = Math.max(6, Math.round(h * 0.8));
  switch (intake) {
    case 'top':
      return { dx: 0, dy: Math.round(-h / 2 - ih / 2 - 1), iw: iwTB, ih };
    case 'bottom':
      return { dx: 0, dy: Math.round(+h / 2 + ih / 2 + 1), iw: iwTB, ih };
    case 'left':
      return { dx: Math.round(-w / 2 - iwLR / 2 - 1), dy: 0, iw: iwLR, ih };
    case 'right':
      return { dx: Math.round(+w / 2 + iwLR / 2 + 1), dy: 0, iw: iwLR, ih };
  }
}

// clamp removed (no longer used)

// Absolute sizes provided directly in config; helper removed

// Local assertion so callers don't need to remember to pre-check.
function assertWorld(w: World | null): asserts w is World {
  if (!w) throw new Error('World not initialized');
}

interface BinModel {
  key: BinSpec['id'];
  pos: { x: number; y: number };
  box: Body;
  intake: Body;
  cap: number;
  fill: number;
  accept: BinSpec['accepts'];
  style: NonNullable<BinSpec['style']>; // defaults to {}
  intakeSide: BinSpec['intake'];
}

function mkOneBin(side: Side, spec: BinSpec): BinModel {
  const [x0, y0] = spec.pos; // bottom-left in canvas coords
  const [w, h] = spec.size;
  const angle = ((spec.rotation ?? 0) * Math.PI) / 180;

  // Mirror LEFT spec across canvas width for RIGHT side
  const xBL = side === SIDE.LEFT ? x0 : sim.W - x0 - w;
  const yBL = y0;

  // Convert bottom-left box to Matter center coordinates
  const cx = xBL + w / 2;
  // Convert bottom-left config Y to canvas/Matter Y (top-left origin)
  const cy = sim.H - (yBL + h / 2);

  const box = Bodies.rectangle(cx, cy, w, h, { isStatic: true, isSensor: true, angle });
  (box as any).plugin = { kind: 'containerWall', side, label: spec.id };

  const o = intakeOffset(spec.intake, w, h);
  const intake = Bodies.rectangle(cx + o.dx, cy + o.dy, o.iw, o.ih, {
    isStatic: true,
    isSensor: true,
    angle,
  });
  (intake as any).plugin = { kind: 'container', accept: spec.accepts, side, label: spec.id };

  const world = sim.world; // capture property to allow type narrowing
  assertWorld(world); // fail fast if not initialized
  World.add(world, [box, intake]);

  return {
    key: spec.id,
    pos: { x: cx, y: cy },
    box,
    intake,
    cap: spec.cap,
    fill: 0,
    accept: spec.accepts,
    style: spec.style ?? {},
    intakeSide: spec.intake,
  };
}

export function makeBins(side: Side, _pinsMid: number, _pinsWidth: number): any {
  const specs = BINS_LEFT.filter((s) => s.enabled !== false);
  const out: any = {};
  for (const spec of specs) out[spec.id] = mkOneBin(side, spec);
  return out;
}
