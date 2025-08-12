import { Bodies, World } from 'matter-js';

import { CORE_HP, CORE_SEGMENTS, CORE_POS } from '../config';
import { SHIELD } from '../config';
import { sim } from '../state';
import { SIDE, type Side } from '../types';

// Local assertion so makeCore can accept nullable input and fail fast.
function assertWorld(w: World | null): asserts w is World {
  if (!w) throw new Error('World not initialized');
}

/**
 * Create a core with configurable segment count + HP, and physics sensors
 * for the outer ring and center. Returns the core model used by draw & game.
 */
export function makeCore(world: World, side: Side, teamColor: string) {
  assertWorld(world);
  const w = world; // now typed as World

  const W = sim.W,
    H = sim.H;

  // --- geometry (position + size) ---
  const sgn = side === SIDE.LEFT ? -1 : 1;

  // pull cores closer to the midline using config
  const offX = CORE_POS.xOffsetFrac * W;
  let cx = W * 0.5 + sgn * offX;
  const cy = H * CORE_POS.yFrac;

  // clamp away from extreme edges (does not change relative midline offset)
  const margin = CORE_POS.edgeMarginPx;
  cx = Math.max(margin, Math.min(W - margin, cx));

  // visual radius (also used by draw)
  const R = Math.min(H * 0.11, W * 0.09);

  // collision sensors (slightly inset ring; small center)
  const ringR = R * 0.82;
  const centerR = R * 0.36;

  // --- dynamic segment count ---
  const nSeg = Math.max(6, Math.floor((sim as any)?.settings?.coreSegments ?? CORE_SEGMENTS));

  // --- physics bodies (sensors) ---
  const ringBody = Bodies.circle(cx, cy, ringR, { isStatic: true, isSensor: true });
  (ringBody as any).plugin = { kind: 'coreRing', side };

  const centerBody = Bodies.circle(cx, cy, centerR, { isStatic: true, isSensor: true });
  (centerBody as any).plugin = { kind: 'coreCenter', side };

  World.add(w, [ringBody, centerBody]);

  // --- core model (ABLATIVE SHIELD fields added) ---
  const core: any = {
    side,
    center: { x: cx, y: cy },
    R,
    radius: R,
    outerR: R,
    ringR,
    centerR,
    ringBody,
    centerBody,
    rot: 0,
    rotSpeed: 0.0025 * (side === SIDE.LEFT ? 1 : -1),

    segHPmax: CORE_HP.segments,
    centerHPmax: CORE_HP.center,
    segHP: new Array(nSeg).fill(CORE_HP.segments),
    centerHP: CORE_HP.center,

    // deprecated legacy fields (kept for backward-compat; no longer used for damage)
    shield: 0,
    shieldMax: CORE_HP.shieldMax ?? 3,

    // NEW ablative pool
    shieldHP: SHIELD.startHP,
    shieldHPmax: SHIELD.maxHP,

    teamColor,
  };

  return core;
}

/**
 * Map a world point to the two nearest segment indices (for boundary hits)
 * and weights that split damage between them.
 */
export function angleToSeg(core: any, p: { x: number; y: number }) {
  const dx = p.x - core.center.x;
  const dy = p.y - core.center.y;
  let ang = Math.atan2(dy, dx) - (core.rot || 0);

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
