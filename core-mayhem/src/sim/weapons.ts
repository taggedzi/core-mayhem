import { Bodies, World, Body, Vector } from 'matter-js';
import { sim } from '../state';
import { Side } from '../types';
import { WEAPON_WINDUP_MS } from '../config';
import { FX_MS } from '../config';
import { PROJ_SPEED, MISSILE_SPREAD_DEG, MISSILE_JITTER_DEG, MISSILE_ARC_TILT_DEG } from '../config';
import { HOMING, HOMING_ENABLED } from '../config';
import { DAMAGE } from '../config';
import { SHOTS_PER_FILL } from '../config';

const DEG = Math.PI / 180;
const rad = (d:number) => d * DEG;

// export function makeWeapons(side:Side){
//   const {W,H} = sim; const gap = Math.max(110, W*0.11);
//   const yTop = H*0.12; const topMid = (side===Side.LEFT? (W/2 - gap*0.6) : (W/2 + gap*0.6));
//   const spread = Math.max(32, W*0.03); const sgn = (side===Side.RIGHT? -1 : 1);
//   const dxs = [-spread, 0, +spread].map(d=> d*sgn); const pos = dxs.map(d=> ({x:topMid+d, y:yTop}));
//   const bottom = {x: side===Side.LEFT? Math.min(W*0.48, W/2 - gap*0.7) : Math.max(W*0.52, W/2 + gap*0.7), y:H*0.90};
//   return { cannon: {pos:pos[0]}, laser:{pos:pos[1]}, missile:{pos:pos[2]}, mortar:{pos:bottom} };
// }

// Queue versions that wait windupMs, then call the real fire functions
export function queueFireCannon(
  from: Side,
  src: { x: number; y: number },
  target: { x: number; y: number },
  burst = 18,
  windupMs = WEAPON_WINDUP_MS
) {
  if ((sim as any).gameOver) return;
  setTimeout(() => {
    if ((sim as any).gameOver) return;
    fireCannon(from, src, target, burst)}, windupMs);
}

export function queueFireLaser(
  from: Side,
  src: { x: number; y: number },
  core: { center: { x: number; y: number } },
  windupMs = WEAPON_WINDUP_MS,
  ms = 600 // laser on-time
) {
  if ((sim as any).gameOver) return;
  setTimeout(() => {
    if ((sim as any).gameOver) return;
    fireLaser(from, src, core, ms)
  }, windupMs);
}

export function queueFireMissiles(
  from: Side,
  src: { x: number; y: number },
  count = 5,
  windupMs = WEAPON_WINDUP_MS,
  arcTiltDeg?: number // optional per-shot override
) {
  if ((sim as any).gameOver) return;
  const target = (from === Side.LEFT ? sim.coreR.center : sim.coreL.center);

  // aim-to-target
  const baseAng = Math.atan2(target.y - src.y, target.x - src.x);

  // mirror the tilt for the right side so both sides “tilt upward”
  const tiltDeg = arcTiltDeg ?? MISSILE_ARC_TILT_DEG;        // e.g. -55
  const mirroredTilt = rad(tiltDeg) * (from === Side.RIGHT ? -1 : 1);

  // this is the *actual* arc center used by fireMissiles
  const center = baseAng + mirroredTilt;
  const spread = rad(MISSILE_SPREAD_DEG);

  // show sweep during wind-up using the same center & spread
  (sim.fxSweep ||= []).push({
    x: src.x, y: src.y,
    t0: performance.now(), ms: windupMs,
    a0: center - spread / 2,
    a1: center + spread / 2,
    side: from
  });

  // fire after wind-up; pass the same tilt so launch matches the indicator
  setTimeout(() => {
    if ((sim as any).gameOver) return;
    fireMissiles(from, src, count, arcTiltDeg)
  }, windupMs);
}

export function queueFireMortar(
  from: Side,
  src: { x: number; y: number },
  count = 1,
  windupMs = WEAPON_WINDUP_MS
) {
  if ((sim as any).gameOver) return;
  setTimeout(() => {
    if ((sim as any).gameOver) return;
    fireMortar(from, src, count)
  }, windupMs);
}

// -- Cannon --
export function fireCannon(from:Side, src:{x:number;y:number}, target:{x:number;y:number}, burst=18){
  if ((sim as any).gameOver) return;
  const dir = Vector.normalise({ x: target.x - src.x, y: target.y - src.y });
  const base = 22 * Math.min(1.8, Math.max(0.9, Vector.magnitude({x:target.x-src.x,y:target.y-src.y})/600));
  const speed = base * PROJ_SPEED.cannon;

  for (let i = 0; i < burst; i++) setTimeout(() => {
    const b = Bodies.circle(src.x, src.y, 4, { restitution:0.2, friction:0.01, density:0.002 });
    (b as any).plugin = { kind:'projectile', ptype:'cannon', side:from, dmg: DAMAGE.cannon, spawnT: performance.now() };
    World.add(sim.world, b);
    const jitter = 3; // small spread
    Body.setVelocity(b, {
      x: dir.x * speed + (Math.random()-0.5) * jitter,
      y: dir.y * speed + (Math.random()-0.5) * jitter
    });
  }, i * 40);
}

// -- Laser (unchanged here; no physical projectile body) --
export function fireLaser(from: Side, src: { x:number; y:number }, core: { center:{x:number; y:number} }, ms = 600) {
  if ((sim as any).gameOver) return;
  const target = core.center;

  // beam line (you already render fxBeam)
  (sim.fxBeam ||= []).push({
    x0: src.x, y0: src.y, x1: target.x, y1: target.y,
    t0: performance.now(), ms, side: from
  });

  // 🔸 add a *colored* burn at impact
  const color = from === Side.LEFT
    ? getComputedStyle(document.documentElement).getPropertyValue('--left').trim()
    : getComputedStyle(document.documentElement).getPropertyValue('--right').trim();

  (sim.fxImp ||= []).push({
    x: target.x, y: target.y,
    t0: performance.now(), ms: FX_MS.burn,
    color,
    kind: 'burn'
  });

  // --- beam collision sensor (so projectiles can "hit" the laser) ---
  const dx = target.x - src.x, dy = target.y - src.y;
  const len = Math.hypot(dx, dy) || 1;
  const ang = Math.atan2(dy, dx);
  const beam = Bodies.rectangle(
    (src.x + target.x) / 2, (src.y + target.y) / 2,
    len, 8, // 8px-thick sensor; invisible
    { isStatic: true, isSensor: true, angle: ang }
  );
  (beam as any).plugin = { kind: 'beamSensor', side: from, until: performance.now() + ms };
  World.add(sim.world, beam);
  setTimeout(() => World.remove(sim.world, beam), ms);

  // damage over time
  const victim = (from === Side.LEFT) ? sim.coreR : sim.coreL;
  const dps = DAMAGE.laserDps;
  let elapsed = 0;
  const id = setInterval(() => {
    const dt = 50; elapsed += dt;
    const mult = victim.shield > 0 ? 0.35 : 1;
    victim.centerHP -= Math.floor((dps * dt / 1000) * mult);
    if (elapsed >= ms) clearInterval(id);
  }, 50);
}

// -- Missiles --
// fireMissiles: spread + optional arc tilt (deg) relative to aim-to-target
export function fireMissiles(
  from: Side,
  src: { x:number; y:number },
  count = 5,
  arcTiltDeg?: number
) {
  if ((sim as any).gameOver) return;
  const target = (from === Side.LEFT ? sim.coreR.center : sim.coreL.center);

  // aim-to-target (works both sides)
  const baseAng = Math.atan2(target.y - src.y, target.x - src.x);

  // ✅ mirror the tilt: left uses negative tilt (up-right), right uses positive (up-left)
  const tilt = arcTiltDeg ?? MISSILE_ARC_TILT_DEG;     // e.g. -55 from your config
  const mirroredTilt = rad(tilt) * (from === Side.RIGHT ? -1 : 1);

  // fan around this center, like before
  const center = baseAng + mirroredTilt;
  const spread = rad(MISSILE_SPREAD_DEG);
  const jitter = rad(MISSILE_JITTER_DEG);

  for (let i = 0; i < count; i++) setTimeout(() => {
    const m = Bodies.circle(src.x, src.y, 5, { density:0.003, frictionAir:0.02 });
    (m as any).plugin = { kind:'projectile', ptype:'missile', side:from, dmg: DAMAGE.missile, spawnT: performance.now() };
    World.add(sim.world, m);

    const t = (count === 1) ? 0 : (i / (count - 1) - 0.5);
    const ang = center + t * spread + (Math.random() - 0.5) * jitter;

    const speed = 8 * PROJ_SPEED.missile;
    Body.setVelocity(m, { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed });

    sim.homing.push(m);
  }, i * 100);
}

// -- Mortar --
export function fireMortar(
  from: Side,
  src: { x:number; y:number },
  count = 1
){
  if ((sim as any).gameOver) return;
  const target = (from===Side.LEFT? sim.coreR.center : sim.coreL.center);
  for (let i = 0; i < count; i++) setTimeout(() => {
    const shell = Bodies.circle(src.x, src.y, 6, { density:0.004, restitution:0.2 });
    (shell as any).plugin = { kind:'projectile', ptype:'mortar', side:from, dmg: DAMAGE.mortar, spawnT: performance.now() };
    World.add(sim.world, shell);
    let vx = (target.x - src.x) / 40 + (Math.random()-0.5) * 2;
    let vy = -16 + (Math.random()-0.5) * 2;
    vx *= PROJ_SPEED.mortar; vy *= PROJ_SPEED.mortar;
    Body.setVelocity(shell, { x: vx, y: vy });
  }, i * 200);
}

const getCSS = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function tickHoming(dtMs: number) {
  if (!HOMING_ENABLED) return;
  const dt = Math.max(0.001, dtMs / 1000);

  const maxTurn = HOMING.maxTurnRadPerSec * dt;
  const accel   = HOMING.accelPerSec * dt;
  const now = performance.now();

  // iterate a copy so we can splice safely
  for (let i = sim.homing.length - 1; i >= 0; i--) {
    const m = sim.homing[i];
    if (!m || !m.position) { sim.homing.splice(i, 1); continue; }

    const plug = (m as any).plugin || {};
    if (plug.ptype !== 'missile') { sim.homing.splice(i, 1); continue; }

    // TTL cleanup
    if (HOMING.ttlMs > 0 && now - (plug.spawnT || now) > HOMING.ttlMs) {
      World.remove(sim.world, m);
      sim.homing.splice(i, 1);
      continue;
    }

    // Target is the opposing core center
    const target = (plug.side === Side.LEFT ? sim.coreR.center : sim.coreL.center);
    const toX = target.x - m.position.x;
    const toY = target.y - m.position.y;
    const toLen = Math.hypot(toX, toY) || 1;
    const desiredAng = Math.atan2(toY, toX);

    // current velocity → angle & speed
    const v = (m as any).velocity || m.velocity || { x: 0, y: 0 };
    const speed = Math.hypot(v.x, v.y);
    const currAng = (speed > 0.001) ? Math.atan2(v.y, v.x) : desiredAng;

    // smallest signed angle diff
    let dAng = desiredAng - currAng;
    while (dAng > Math.PI) dAng -= Math.PI * 2;
    while (dAng < -Math.PI) dAng += Math.PI * 2;

    // limit turn rate
    const turn = Math.max(-maxTurn, Math.min(maxTurn, dAng));
    const newAng = currAng + turn;

    // accelerate toward maxSpeed
    const newSpeed = Math.min(HOMING.maxSpeed, speed + accel);

    // set new velocity
    const nvx = Math.cos(newAng) * newSpeed;
    const nvy = Math.sin(newAng) * newSpeed;
    Body.setVelocity(m, { x: nvx, y: nvy });

    // optional fuse (close detonation); set HOMING.fuseRadius > 0 to enable
    if (HOMING.fuseRadius > 0 && toLen < HOMING.fuseRadius) {
      World.remove(sim.world, m);
      sim.homing.splice(i, 1);
      // (visual pop only; real damage still comes from collisions)
      (sim.fxImp ||= []).push({
        x: target.x, y: target.y, t0: now, ms: 350, color: '#ffb700', kind: 'burst'
      });
    }
  }
}

// --- tweakables ---
const TOP_Y_FRACTION     = 0.13; // unchanged
const OFFSET_FROM_MID_R  = 0.80; // unchanged (your value)
const SPACING_R          = 0.90; // unchanged (your value)
const EDGE_MARGIN_PX     = 24;   // unchanged

// NEW: vertical staggering measured in "core radii"
const LASER_Y_OFFSET_R   = 0.45;  // laser sits lower than cannon by ~0.45R
const MISSILE_Y_OFFSET_R = 0.90;  // missile sits lower than cannon by ~0.90R


function coreRadiusFor(side: Side): number {
  const core = side === Side.LEFT ? sim.coreL : sim.coreR;
  // Support multiple possible radius field names; fallback to a sensible guess.
  const r = (core as any).outerR ?? (core as any).R ?? (core as any).radius ?? (core as any).ringR;
  return (typeof r === 'number' && r > 4) ? r : Math.max(30, sim.H * 0.09);
}

function clampX(x: number) {
  return Math.min(sim.W - EDGE_MARGIN_PX, Math.max(EDGE_MARGIN_PX, x));
}

// tweakables for bottom artillery
const BOTTOM_Y_FRACTION   = 0.88; // vertical row near bottom
const ARTY_X_FROM_MID_R   = 0.45; // horizontal offset from midline (in core radii)

export function makeWeapons(side: Side) {
  const mid = sim.W * 0.5;
  const r   = coreRadiusFor(side);       // you already have this helper in the file

  // top row (your existing code)
  const yCannon  = Math.max(36, sim.H * TOP_Y_FRACTION);
  const yLaser   = yCannon + r * LASER_Y_OFFSET_R;
  const yMissile = yCannon + r * MISSILE_Y_OFFSET_R;

  const sgn  = side === Side.LEFT ? -1 : +1;
  const base = mid + sgn * (r * OFFSET_FROM_MID_R);
  const step = r * SPACING_R;

  const xCannon  = clampX(base);
  const xLaser   = clampX(base + sgn * step);
  const xMissile = clampX(base + sgn * step * 2);

  // 🔸 bottom artillery
  const yMortar  = Math.min(sim.H - 36, sim.H * BOTTOM_Y_FRACTION);
  const xMortar  = clampX(mid + sgn * (r * ARTY_X_FROM_MID_R));

  const mk = (x: number, y: number, label: string) => {
    const mount = Bodies.circle(x, y, 5, { isStatic: true, isSensor: true });
    (mount as any).plugin = { kind: 'weaponMount', side, label };
    World.add(sim.world, mount);
    return { pos: { x, y }, mount };
  };

  const cannon  = mk(xCannon,  yCannon,  'cannon');
  const laser   = mk(xLaser,   yLaser,   'laser');
  const missile = mk(xMissile, yMissile, 'missile');
  const mortar  = mk(xMortar,  yMortar,  'mortar');  // ⬅️ back again

  return { cannon, laser, missile, mortar };
}
