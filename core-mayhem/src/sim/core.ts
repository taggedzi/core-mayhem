import { Bodies, World } from 'matter-js';

import { CORE } from '../config';
import { SHIELD } from '../config';
import { sim } from '../state';
import { SIDE, type Side } from '../types';

// Local assertion so makeCore can accept nullable input and fail fast.
function assertWorld(w: World | null): asserts w is World {
  if (!w) throw new Error('World not initialized');
}

// Define the shape your function returns
export interface Core {
  side: Side;
  center: { x: number; y: number };
  R: number; // visual radius
  radius: number; // alias of R
  outerR: number; // alias of R
  ringR: number;
  centerR: number;
  ringBody: Body;
  centerBody: Body;
  rot: number;
  rotSpeed: number;

  segHPmax: number;
  centerHPmax: number;
  segHP: number[];
  centerHP: number;

  // legacy/compat fields
  shield: number;
  shieldMax: number;

  // ablative shield pool
  shieldHP: number;
  shieldHPmax: number;

  teamColor: string;
}

/**
 * Create a core with configurable segment count + HP, and physics sensors
 * for the outer ring and center. Returns the core model used by draw & game.
 */
export function makeCore(world: World, side: Side, teamColor: string): Core {
  assertWorld(world);
  const w = world; // now typed as World

  const W = sim.W,
    H = sim.H;

  // --- geometry (position + size) ---
  // Absolute placement: LEFT defined in config; RIGHT is exact mirror
  const r = Math.max(1, Math.floor(CORE.radius));
  const [xBL, yBL] = CORE.pos;
  const cLx = xBL + r;
  // Convert bottom-left config Y to canvas/Matter Y (top-left origin)
  const cyCanvas = H - (yBL + r);
  const cx = side === SIDE.LEFT ? cLx : W - cLx;
  const margin = CORE.edgeMarginPx;
  // Clamp center within margins (safety)
  const cxClamped = Math.max(margin, Math.min(W - margin, cx));
  const cyClamped = Math.max(margin, Math.min(H - margin, cyCanvas));

  // visual radius (also used by draw)
  const R = r;

  // collision sensors (slightly inset ring; small center)
  const ringR = R * 0.82;
  const centerR = R * 0.36;

  // --- dynamic segment count ---
  const nSeg = Math.max(6, Math.floor((sim as any)?.settings?.coreSegments ?? CORE.segments.count));

  // --- physics bodies (sensors) ---
  const ringBody = Bodies.circle(cxClamped, cyClamped, ringR, { isStatic: true, isSensor: true });
  (ringBody as any).plugin = { kind: 'coreRing', side };

  const centerBody = Bodies.circle(cxClamped, cyClamped, centerR, { isStatic: true, isSensor: true });
  (centerBody as any).plugin = { kind: 'coreCenter', side };

  World.add(w, [ringBody, centerBody]);

  // --- core model (ABLATIVE SHIELD fields added) ---
  const core: any = {
    side,
    center: { x: cxClamped, y: cyClamped },
    R,
    radius: R,
    outerR: R,
    ringR,
    centerR,
    ringBody,
    centerBody,
    rot: 0,
    rotSpeed: 0.0025 * (side === SIDE.LEFT ? 1 : -1),

    segHPmax: CORE.segments.hp,
    centerHPmax: CORE.hp,
    segHP: new Array(nSeg).fill(CORE.segments.hp),
    centerHP: CORE.hp,

    // deprecated legacy fields (kept for backward-compat; no longer used for damage)
    shield: 0,
    shieldMax: SHIELD.maxHP,

    // NEW ablative pool
    shieldHP: SHIELD.startHP,
    shieldHPmax: SHIELD.maxHP,

    teamColor,
  };

  return core;
}

interface Seg {
  i0: number;
  i1: number;
  w0: number;
  w1: number;
}

/**
 * Map a world point to the two nearest segment indices (for boundary hits)
 * and weights that split damage between them.
 */
export function angleToSeg(core: any, p: { x: number; y: number }): Seg {
  const dx = p.x - core.center.x;
  const dy = p.y - core.center.y;
  let ang = Math.atan2(dy, dx) - (core.rot ?? 0);

  const TAU = Math.PI * 2;
  while (ang < 0) ang += TAU;
  while (ang >= TAU) ang -= TAU;

  const n = core.segHP.length; // dynamic segment count
  const seg = TAU / n;
  const f = ang / seg;
  const i0 = Math.floor(f) % n;
  const frac = f - Math.floor(f);
  const i1 = (i0 + 1) % n;

  // weights sum to 1; when on a boundary, damage splits across slices
  return { i0, i1, w0: 1 - frac, w1: frac };
}
