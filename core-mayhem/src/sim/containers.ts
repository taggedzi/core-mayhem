import { Bodies, Body, World } from 'matter-js';

import { BIN_INTAKE_H, BINS_LEFT, type BinSpec, type IntakeSide } from '../config';
import { sim } from '../state';
import { SIDE, type Side } from '../types';

/**
 * Nudge all bins on a side so they stay at least `margin` px away from that side's
 * pipe inner wall (uses sim.pipes[0|1].innerX; no world scanning).
 * Safe no-op if something isn’t ready.
 */
export function nudgeBinsFromPipes(side: Side, bins: any, margin = 5) {
  if (!bins || !sim.pipes) return;
  const pipe = side === SIDE.LEFT ? sim.pipes[0] : sim.pipes[1];
  const innerX = (pipe as any)?.innerX;
  if (typeof innerX !== 'number' || Number.isNaN(innerX)) return;

  const isLeft = side === SIDE.LEFT;
  const safeEdgeX = isLeft ? innerX + margin : innerX - margin;

  const shiftIfNeeded = (bin: any) => {
    const wall = bin?.box || bin?.body || bin?.intake;
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

function sidePanelX(side: Side, pinsMid: number, pinsWidth: number, xFrac: number): number {
  const x0 = pinsMid - pinsWidth / 2; // outer wall
  const x1 = pinsMid + pinsWidth / 2; // near midline
  if (side === SIDE.LEFT) return x0 + xFrac * (x1 - x0);
  const mirrored = 1 - xFrac; // mirror on right
  return x0 + mirrored * (x1 - x0);
}

function intakeOffset(intake: IntakeSide, w: number, h: number) {
  const ih = BIN_INTAKE_H;
  const iwTB = Math.max(12, w * 0.92);
  const iwLR = Math.max(6, h * 0.8);
  switch (intake) {
    case 'top':
      return { dx: 0, dy: -h / 2 - ih / 2 - 1, iw: iwTB, ih };
    case 'bottom':
      return { dx: 0, dy: +h / 2 + ih / 2 + 1, iw: iwTB, ih };
    case 'left':
      return { dx: -w / 2 - iwLR / 2 - 1, dy: 0, iw: iwLR, ih };
    case 'right':
      return { dx: +w / 2 + iwLR / 2 + 1, dy: 0, iw: iwLR, ih };
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function sizePxFromFrac(sizeFrac: [number, number], pinsWidth: number) {
  // Width scales with channel width; height with canvas height
  const minW = Math.max(40, pinsWidth * 0.06);
  const maxW = Math.max(minW + 1, pinsWidth * 0.45);
  const minH = Math.max(22, sim.H * 0.02);
  const maxH = Math.max(minH + 1, sim.H * 0.09);

  const w = clamp(sizeFrac[0] * pinsWidth, minW, maxW);
  const h = clamp(sizeFrac[1] * sim.H, minH, maxH);
  return { w, h };
}

// Local assertion so callers don't need to remember to pre-check.
function assertWorld(w: World | null): asserts w is World {
  if (!w) throw new Error('World not initialized');
}

function mkOneBin(side: Side, spec: BinSpec, pinsMid: number, pinsWidth: number) {
  const [xFrac, yFrac] = spec.pos;
  const { w, h } = sizePxFromFrac(spec.sizeFrac, pinsWidth);
  const angle = ((spec.rotation || 0) * Math.PI) / 180;

  const x = sidePanelX(side, pinsMid, pinsWidth, xFrac);
  const y = yFrac * sim.H;

  const box = Bodies.rectangle(x, y, w, h, { isStatic: true, isSensor: true, angle });
  (box as any).plugin = { kind: 'containerWall', side, label: spec.id };

  const o = intakeOffset(spec.intake, w, h);
  const intake = Bodies.rectangle(x + o.dx, y + o.dy, o.iw, o.ih, {
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
    pos: { x, y },
    box,
    intake,
    cap: spec.cap,
    fill: 0,
    accept: spec.accepts,
    style: spec.style || {},
    intakeSide: spec.intake,
  };
}

export function makeBins(side: Side, pinsMid: number, pinsWidth: number) {
  const specs = BINS_LEFT.filter((s) => s.enabled !== false);
  const out: any = {};
  for (const spec of specs) out[spec.id] = mkOneBin(side, spec, pinsMid, pinsWidth);
  return out;
}
