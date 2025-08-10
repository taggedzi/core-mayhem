import { Bodies, Body, World } from 'matter-js';

import { BIN_INTAKE_H, BINS_LEFT, type BinSpec, type IntakeSide } from '../config';
import { sim } from '../state';
import { SIDE, type Side } from '../types';

import type { Bins } from '../types';

// function layoutBins(side: Side, bins: any, pinsMid: number, pinsWidth: number) {
//   if (!bins) return;

//   // Measure a box once to get width/height
//   const sample = (['cannon','laser','missile','buff','debuff','mortar','shield','repair']
//     .map(k => (bins as any)[k])
//     .find(b => b && (b.box || b.body))) as any;
//   if (!sample) return;
//   const ref = sample.box || sample.body;
//   const bw = ref.bounds.max.x - ref.bounds.min.x;
//   const bh = ref.bounds.max.y - ref.bounds.min.y;

//   // Spacing
//   const hGap = Math.max(10, sim.W * 0.012);
//   const vGap = Math.max(8,  sim.H * 0.010);

//   // We’ll keep rows under the pin field; clamp span a bit
//   const colsTop = 4, colsBot = 4;
//   const spanTop = Math.min(pinsWidth * 0.82, colsTop * bw + (colsTop - 1) * hGap);
//   const xStart  = pinsMid - spanTop / 2;
//   const step    = (spanTop - bw) / (colsTop - 1);   // center-to-center

//   // Vertical placement
//   const yTop = sim.H * 0.86;
//   const yBot = yTop + bh + vGap;

//   // Your requested orders (mirrored)
//   const topL = ['cannon','laser','missile','buff'];
//   const topR = ['buff','missile','laser','cannon'];
//   const botL = ['mortar','shield','repair','debuff'];
//   const botR = ['debuff','repair','shield','mortar'];

//   const topOrder = side === SIDE.LEFT ? topL : topR;
//   const botOrder = side === SIDE.LEFT ? botL : botR;

//   // Top row
//   topOrder.forEach((key, i) => {
//     const b = (bins as any)[key]; if (!b) return;
//     const pos = { x: xStart + i * step, y: yTop };
//     b.pos = pos;
//     if (b.box)    Body.setPosition(b.box, pos);
//     if (b.intake) Body.setPosition(b.intake, { x: pos.x, y: pos.y - bh/2 });
//   });

//   // Bottom row — staggered half-step
//   const botStart = xStart + step * 0.5;
//   botOrder.forEach((key, i) => {
//     const b = (bins as any)[key]; if (!b) return;
//     const pos = { x: botStart + i * step, y: yBot };
//     b.pos = pos;
//     if (b.box)    Body.setPosition(b.box, pos);
//     if (b.intake) Body.setPosition(b.intake, { x: pos.x, y: pos.y - bh/2 });
//   });
// }

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

// // Staggered bins with a visible/top-edge intake sensor (uses config BIN_INTAKE_H)
// /** Staggered bins with thin-wall boxes and a visible intake strip just above each box. */
// export function makeBins(side: Side, mid: number, width: number): Bins {
//   const { W, H } = sim;

//   // Box size (stroke-only look is in draw.ts)
//   const cw = Math.max(54, Math.min(96, W * 0.035));
//   const ch = Math.max(26, Math.min(46, H * 0.038));

//   // Row Y
//   const conveyorY = H * 0.915;
//   const yBottom   = Math.round(conveyorY - 15 - ch * 0.5);
//   const baseRowGap = Math.max(14, H * 0.03);
//   const rowGap     = Math.round(baseRowGap * BIN_V_SPREAD);
//   const yTop       = yBottom - (ch + rowGap);

//   // Column spacing inside a channel (guarantee a minimum so boxes never overlap)
//   const baseSpread  = width * 0.32;
//   const computed    = baseSpread * BIN_H_SPREAD;           // user knob
//   const minSpread   = cw * 1.6;                            // hard floor
//   const colSpread   = Math.max(minSpread, Math.min(width * 0.48, computed));
//   const xAt = (k: number) => mid + k * colSpread;

//   // ----- TOP ROW (5 bins) — mirrored mapping -----
//   // Offsets: -2, -1, 0, +1, +2 (left→right within that channel)
//   const topOffsets = [-2, -1, 0, +1, +2];

//   // Left wants: [buff, cannon, laser, missile, debuff]
//   // Right mirrors it: [debuff, missile, laser, cannon, buff]
//   const topOrder = (side === SIDE.LEFT)
//     ? ['buff','cannon','laser','missile','debuff']
//     : ['debuff','missile','laser','cannon','buff'];

//   // ----- BOTTOM ROW (3 bins) — staggered between the top columns -----
//   // Offsets sit between the top ones: [-1.5, 0, +1.5]
//   const botOffsets = [-1.5, 0, +1.5];

//   // Left:  [mortar, shield, repair]
//   // Right: [repair, shield, mortar] (mirror)
//   const botOrder = (side === SIDE.LEFT)
//     ? ['mortar','shield','repair']
//     : ['repair','shield','mortar'];

//   const anyAmmo = ['basic','heavy','volatile','emp','shield','repair'];
//   const caps = CONTAINER_CAP;

//   const mk = (x: number, y: number, key: string, accept: string[], cap: number) => {
//     const box = Bodies.rectangle(x, y, cw, ch, { isStatic: true, isSensor: true });
//     (box as any).plugin = { kind: 'containerWall', side, label: key };

//     const intakeW = cw * 0.92;
//     const intakeY = y - ch / 2 - BIN_INTAKE_H / 2 - 1;
//     const intake = Bodies.rectangle(x, intakeY, intakeW, BIN_INTAKE_H, { isStatic: true, isSensor: true });
//     (intake as any).plugin = { kind: 'container', accept, side, label: key };

//     World.add(sim.world, [box, intake]);
//     return { key, pos: { x, y }, box, intake, cap, fill: 0, accept };
//   };

//   // Build TOP
//   const top: Record<string, any> = {};
//   topOrder.forEach((k, i) => {
//     const x = xAt(topOffsets[i]);
//     const cap =
//       k === 'buff'   ? GLOBAL_MODS.cap.buff   :
//       k === 'debuff' ? GLOBAL_MODS.cap.debuff :
//       (caps as any)[k];
//     const accept =
//       k === 'cannon'  ? ['basic','heavy','volatile'] :
//       k === 'laser'   ? ['basic','emp'] :
//       k === 'missile' ? ['heavy','volatile'] :
//       anyAmmo;
//     top[k] = mk(x, yTop, k, accept, cap);
//   });

//   // Build BOTTOM (staggered)
//   const bot: Record<string, any> = {};
//   botOrder.forEach((k, i) => {
//     const x = xAt(botOffsets[i]);
//     const cap = (caps as any)[k];
//     const accept =
//       k === 'mortar' ? ['basic','heavy'] :
//       k === 'shield' ? ['emp','shield']  :
//       k === 'repair' ? ['repair']        : anyAmmo;
//     bot[k] = mk(x, yBottom, k, accept, cap);
//   });

//   // after creating all bins.* including buff & debuff
//   layoutBins(side, bins, pinsMid, pinsWidth);

//   // keep your “nudge-from-pipes” after layout if you use it
//   if (typeof nudgeBinsFromPipes === 'function') nudgeBinsFromPipes(bins, side);

//   return {
//     cannon:  top.cannon,
//     laser:   top.laser,
//     missile: top.missile,
//     debuff:  top.debuff,
//     buff:    top.buff,
//     mortar:  bot.mortar,
//     shield:  bot.shield,
//     repair:  bot.repair,
//   };
// }

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

  World.add(sim.world, [box, intake]);

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
