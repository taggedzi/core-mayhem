import { Bodies, Body, World } from 'matter-js';
import type { Bins } from '../types';
import { sim } from '../state';
import { Side } from '../types';
import { BIN_INTAKE_H, BIN_H_SPREAD, BIN_V_SPREAD } from '../config';
import { CONTAINER_CAP } from '../config';

/**
 * Nudge all bins on a side so they stay at least `margin` px away from that side's
 * pipe inner wall (uses sim.pipes[0|1].innerX; no world scanning).
 * Safe no-op if something isn’t ready.
 */
export function nudgeBinsFromPipes(side: Side, bins: any, margin = 5) {
  if (!bins || !sim.pipes) return;
  const pipe = side === Side.LEFT ? sim.pipes[0] : sim.pipes[1];
  const innerX = pipe?.innerX;
  if (typeof innerX !== 'number' || Number.isNaN(innerX)) return;

  const isLeft = side === Side.LEFT;
  const safeEdgeX = isLeft ? innerX + margin : innerX - margin;

  const shiftIfNeeded = (bin: any) => {
    if (!bin?.body) return;
    const bw = bin.body.bounds.max.x - bin.body.bounds.min.x;
    const half = bw * 0.5;
    const cx = bin.body.position.x;
    let nx = cx;

    if (isLeft) {
      if (cx - half < safeEdgeX) nx = safeEdgeX + half;
    } else {
      if (cx + half > safeEdgeX) nx = safeEdgeX - half;
    }

    if (nx !== cx && Number.isFinite(nx)) {
      Body.setPosition(bin.body,   { x: nx, y: bin.body.position.y });
      if (bin.intake) {
        Body.setPosition(bin.intake, { x: nx, y: bin.intake.position.y });
      }
    }
  };

  Object.values(bins as Record<string, any>).forEach(shiftIfNeeded);
}

// Staggered bins with a visible/top-edge intake sensor (uses config BIN_INTAKE_H)
export function makeBins(side: -1 | 1, mid: number, width: number): Bins {
  const { W, H } = sim;

  // Responsive box size (thin-wall look is drawn in draw.ts)
  const cw = Math.max(54, Math.min(96, W * 0.035));
  const ch = Math.max(26, Math.min(46, H * 0.038));

  // Conveyor is ~H*0.915; keep bottom row ~15px above it
  const conveyorY = H * 0.915;
  const yBottom = conveyorY - 15 - ch * 0.5;

  // Vertical spacing (you already have BIN_V_SPREAD in config)
  const baseGap = Math.max(14, H * 0.03);
  const rowGap = Math.round(baseGap * BIN_V_SPREAD);
  const yTop = yBottom - (ch + rowGap);

  // Three columns centered on pin field, with horizontal spread tunable
  const baseSpread = width * 0.32;
  const colSpread = Math.min(width * 0.48, baseSpread * BIN_H_SPREAD);
  const xTopCols = [mid - colSpread, mid, mid + colSpread];

  // Bottom row stagger (LEFT shifts right, RIGHT shifts left)
  const half = (xTopCols[1] - xTopCols[0]) * 0.5;
  const shift = (side < 0 ? +half : -half);
  const xBotCols = xTopCols.map(x => x + shift);

  // Reorder columns so index 0 is nearest that side's pipe, index 2 near midline
  // LEFT pipe is at far left → leftmost is "near pipe"
  // RIGHT pipe is at far right → rightmost is "near pipe"
  const posTop = (side < 0)
    ? [xTopCols[0], xTopCols[1], xTopCols[2]]  // L: nearPipe, middle, nearMid
    : [xTopCols[2], xTopCols[1], xTopCols[0]]; // R: nearPipe, middle, nearMid
  const posBot = (side < 0)
    ? [xBotCols[0], xBotCols[1], xBotCols[2]]
    : [xBotCols[2], xBotCols[1], xBotCols[0]];

  // Helper: visual thin box (sensor) + slim intake sensor just above top edge
  const mk = (x: number, y: number, label: string, accept: string[], cap: number) => {
    const box = Bodies.rectangle(x, y, cw, ch, { isStatic: true, isSensor: true });
    (box as any).plugin = { kind: 'containerWall', side, label };

    const intakeW = cw * 0.92;
    const intakeY = y - ch / 2 - BIN_INTAKE_H / 2 - 1;
    const intake = Bodies.rectangle(x, intakeY, intakeW, BIN_INTAKE_H, {
      isStatic: true, isSensor: true
    });
    (intake as any).plugin = { kind: 'container', accept, side, label };

    World.add(sim.world, [box, intake]);
    return { body: box, intake, accept, fill: 0, cap, label } as any;
  };

  // TOP row (near pipe → midline): CANNON, LASER, MISSILE
  const cannon  = mk(posTop[0], yTop,    'cannon',  ['basic','heavy','volatile'], CONTAINER_CAP.cannon);
  const laser   = mk(posTop[1], yTop,    'laser',   ['basic','emp'],              CONTAINER_CAP.laser);
  const missile = mk(posTop[2], yTop,    'missile', ['heavy','volatile'],         CONTAINER_CAP.missile);

  // BOTTOM row (near pipe → midline): MORTAR, SHIELD, REPAIR
  const mortar  = mk(posBot[0], yBottom, 'mortar',  ['basic','heavy'], CONTAINER_CAP.mortar);
  const shield  = mk(posBot[1], yBottom, 'shield',  ['emp','shield'],  CONTAINER_CAP.shield);
  const repair  = mk(posBot[2], yBottom, 'repair',  ['repair'],        CONTAINER_CAP.repair);

  return { cannon, laser, missile, mortar, shield, repair };
}
