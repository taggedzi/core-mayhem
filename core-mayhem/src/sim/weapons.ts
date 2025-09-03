import { Bodies, World, Body, Vector } from 'matter-js';

import { currentDmgMul } from '../app/mods';
import { isDisabled } from '../app/mods';
import { LASER_FX } from '../config';
import { DAMAGE } from '../config';
import { WEAPON_WINDUP_MS } from '../config';
import {
  PROJ_SPEED,
  MISSILE_SPREAD_DEG,
  MISSILE_JITTER_DEG,
  MISSILE_ARC_TILT_DEG,
} from '../config';
import { HOMING, HOMING_ENABLED } from '../config';
import { MORTAR_ANGLE } from '../config';
import { SHIELD } from '../config';
import { angleToSeg } from '../sim/core';
import { sim } from '../state';
import { SIDE, type Side } from '../types';

import { applyCoreDamage } from './damage';

import type { Vec } from '../types';
import type { World as MatterWorld } from 'matter-js';
import { WEAPONS_LEFT } from '../config';

const DEG = Math.PI / 180;
const rad = (d: number): number => d * DEG;
interface Vec2 {
  x: number;
  y: number;
}
interface CoreLike {
  center: Vec2;
  shield?: number;
  segHP?: number[];
  centerHP?: number;
}

// --- local asserts (your chosen pattern: centralized, fail-fast) ---
function assertWorld(w: MatterWorld | null): asserts w is MatterWorld {
  if (!w) throw new Error('World not initialized');
}
function assertCore(c: any): asserts c is { center: Vec2 } {
  if (!c || !c.center) throw new Error('Core not initialized');
}

// Queue versions that wait windupMs, then call the real fire functions
export function queueFireCannon(
  from: Side,
  src: { x: number; y: number },
  target: { x: number; y: number },
  burst = 18,
  windupMs = WEAPON_WINDUP_MS,
): void {
  if (sim.gameOver) return;
  // example in queueFireCannon or fireCannon
  if (isDisabled(from, 'cannon')) return;
  setTimeout(() => {
    if (sim.gameOver) return;
    fireCannon(from, src, target, burst);
  }, windupMs);
}

export function queueFireLaser(
  from: Side,
  src: { x: number; y: number },
  core: { center: { x: number; y: number } },
  windupMs = WEAPON_WINDUP_MS,
): void {
  if (sim.gameOver) return;
  if (isDisabled(from, 'laser')) return;
  setTimeout(() => {
    if (sim.gameOver) return;
    // fireLaser takes (side, src, target?) — duration is handled by LASER_FX
    fireLaser(from, src, core);
  }, windupMs);
}

export function queueFireMissiles(
  from: Side,
  src: { x: number; y: number },
  count = 5,
  windupMs = WEAPON_WINDUP_MS,
  arcTiltDeg?: number, // optional per-shot override
): void {
  if (sim.gameOver) return;
  if (isDisabled(from, 'missile')) return;
  let target: Vec;
  {
    const targetCore = from === SIDE.LEFT ? sim.coreR : sim.coreL;
    assertCore(targetCore);
    target = targetCore.center;
  }

  // aim-to-target
  const baseAng = Math.atan2(target.y - src.y, target.x - src.x);

  // mirror the tilt for the right side so both sides “tilt upward”
  const tiltDeg = arcTiltDeg ?? MISSILE_ARC_TILT_DEG; // e.g. -55
  const mirroredTilt = rad(tiltDeg) * (from === SIDE.RIGHT ? -1 : 1);

  // this is the *actual* arc center used by fireMissiles
  const center = baseAng + mirroredTilt;
  const spread = rad(MISSILE_SPREAD_DEG);

  // show sweep during wind-up using the same center & spread
  // Keep sweep direction visually consistent (up -> down) on both sides
  const sweepA0 = from === SIDE.RIGHT ? center + spread / 2 : center - spread / 2;
  const sweepA1 = from === SIDE.RIGHT ? center - spread / 2 : center + spread / 2;
  (sim.fxSweep ||= []).push({
    x: src.x,
    y: src.y,
    t0: performance.now(),
    ms: windupMs,
    a0: sweepA0,
    a1: sweepA1,
    side: from,
  });

  // fire after wind-up; pass the same tilt so launch matches the indicator
  setTimeout(() => {
    if (sim.gameOver) return;
    fireMissiles(from, src, count, arcTiltDeg);
  }, windupMs);
}

export function queueFireMortar(
  from: Side,
  src: { x: number; y: number },
  count = 1,
  windupMs = WEAPON_WINDUP_MS,
): void {
  if (sim.gameOver) return;
  if (isDisabled(from, 'mortar')) return;
  setTimeout(() => {
    if ((sim as any).gameOver) return;
    fireMortar(from, src, count);
  }, windupMs);
}

// -- Cannon --
export function fireCannon(
  from: Side,
  src: { x: number; y: number },
  target: { x: number; y: number },
  burst = 18,
): void {
  if (sim.gameOver) return;
  if (isDisabled(from, 'cannon')) return;
  const dir = Vector.normalise({ x: target.x - src.x, y: target.y - src.y });
  const base =
    22 *
    Math.min(
      1.8,
      Math.max(0.9, Vector.magnitude({ x: target.x - src.x, y: target.y - src.y }) / 600),
    );
  const speed = base * PROJ_SPEED.cannon;
  const mul = currentDmgMul(from);

  for (let i = 0; i < burst; i++)
    setTimeout(() => {
      const b = Bodies.circle(src.x, src.y, 4, {
        restitution: 0.2,
        friction: 0.01,
        density: 0.002,
      });
      (b as any).plugin = {
        kind: 'projectile',
        ptype: 'cannon',
        side: from,
        dmg: DAMAGE.cannon * mul,
        spawnT: performance.now(),
      };
      {
        const w = sim.world;
        assertWorld(w);
        World.add(w, b);
      }
      const jitter = 3; // small spread
      Body.setVelocity(b, {
        x: dir.x * speed + (Math.random() - 0.5) * jitter,
        y: dir.y * speed + (Math.random() - 0.5) * jitter,
      });
    }, i * 40);
}

// -- Laser (unchanged here; no physical projectile body) --
export function fireLaser(side: Side, src: Vec2, target?: CoreLike | Vec2): void {
  if ((sim as any).gameOver) return;
  if (isDisabled(side, 'laser')) return;

  // Resolve core to hit (or a point)
  const enemyCore: CoreLike =
    target && (target as any).center
      ? (target as CoreLike)
      : side === SIDE.LEFT
        ? (sim as any).coreR
        : (sim as any).coreL;
  if (!enemyCore || !enemyCore.center) return;

  const aim: Vec2 = target && !(target as any).center ? (target as Vec2) : enemyCore.center;

  // --- Laser damage with ablative shield ---
  // Base damage for this laser pulse, scaled by side's buff
  const base = DAMAGE.laserDps * currentDmgMul(side);

  // If this core uses ablative shields, split between shield drain and core penetration.
  // Fallback: if shieldHP is undefined, behave like no shield (apply full base to core).
  let toCore = base;

  if (
    typeof (enemyCore as any).shieldHP === 'number' &&
    typeof (enemyCore as any).shieldHPmax === 'number'
  ) {
    const coreAny = enemyCore as any;
    if (coreAny.shieldHP > 0) {
      // Portion that penetrates to the core while shield is up
      toCore = base * SHIELD.laserPenetration;
      // Portion that drains the shield pool (optionally amplified)
      const toShield = base * (1 - SHIELD.laserPenetration) * SHIELD.laserShieldFactor;
      coreAny.shieldHP = Math.max(0, coreAny.shieldHP - toShield);
    } else {
      toCore = base; // shield depleted: all damage hits core
    }
  }

  // Apply damage to core exactly once (your helper handles center/segments)
  applyCoreDamage(enemyCore as any, aim, toCore, angleToSeg);

  // --- FX (kept as you had it) ---
  const now = performance.now();
  sim.fxBeams = sim.fxBeams ?? [];
  sim.fxBeams.push({
    x1: src.x,
    y1: src.y,
    x2: aim.x,
    y2: aim.y,
    side,
    t0: now,
    tEnd: now + LASER_FX.beamMs,
  });

  sim.fxBursts = sim.fxBursts ?? [];
  sim.fxBursts.push({
    x: src.x,
    y: src.y,
    t0: now,
    tEnd: now + LASER_FX.flashMs,
    side,
    kind: 'muzzle',
  });
  sim.fxBursts.push({
    x: aim.x,
    y: aim.y,
    t0: now,
    tEnd: now + LASER_FX.flashMs,
    side,
    kind: 'impact',
  });
}

// -- Missiles --
// fireMissiles: spread + optional arc tilt (deg) relative to aim-to-target
export function fireMissiles(
  from: Side,
  src: { x: number; y: number },
  count = 5,
  arcTiltDeg?: number,
): void {
  if ((sim as any).gameOver) return;
  if (isDisabled(from, 'missile')) return;
  let target: Vec;
  {
    const targetCore = from === SIDE.LEFT ? sim.coreR : sim.coreL;
    assertCore(targetCore);
    target = targetCore.center;
  }

  // aim-to-target (works both sides)
  const baseAng = Math.atan2(target.y - src.y, target.x - src.x);

  // ✅ mirror the tilt: left uses negative tilt (up-right), right uses positive (up-left)
  const tilt = arcTiltDeg ?? MISSILE_ARC_TILT_DEG; // e.g. -55 from your config
  const mirroredTilt = rad(tilt) * (from === SIDE.RIGHT ? -1 : 1);

  // fan around this center, like before
  const center = baseAng + mirroredTilt;
  const spread = rad(MISSILE_SPREAD_DEG);
  const jitter = rad(MISSILE_JITTER_DEG);
  const mul = currentDmgMul(from);

  for (let i = 0; i < count; i++)
    setTimeout(() => {
      const m = Bodies.circle(src.x, src.y, 5, { density: 0.003, frictionAir: 0.02 });
      (m as any).plugin = {
        kind: 'projectile',
        ptype: 'missile',
        side: from,
        dmg: DAMAGE.missile * mul,
        spawnT: performance.now(),
      };
      {
        const w = sim.world;
        assertWorld(w);
        World.add(w, m);
      }

      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const ang = center + t * spread + (Math.random() - 0.5) * jitter;

      const speed = 8 * PROJ_SPEED.missile;
      Body.setVelocity(m, { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed });

      sim.homing.push(m);
    }, i * 100);
}

// -- Mortar --
export function fireMortar(from: Side, src: { x: number; y: number }, count = 1): void {
  if ((sim as any).gameOver) return;
  if (isDisabled(from, 'mortar')) return;
  let target: Vec;
  {
    const targetCore = from === SIDE.LEFT ? sim.coreR : sim.coreL;
    assertCore(targetCore);
    target = targetCore.center;
  }

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const shell = Bodies.circle(src.x, src.y, 6, {
        density: 0.004,
        restitution: 0.2,
        frictionAir: 0.015,
      });
      (shell as any).plugin = {
        kind: 'projectile',
        ptype: 'mortar',
        side: from,
        dmg: DAMAGE.mortar * currentDmgMul(from),
        spawnT: performance.now(),
        gExtra: MORTAR_ANGLE.extraGravity || 0,
      };
      {
        const w = sim.world;
        assertWorld(w);
        World.add(w, shell);
      }

      // Aim left->right or right->left based on target
      const dx = target.x - src.x;
      const sgn = Math.sign(dx) || (from === SIDE.LEFT ? +1 : -1);

      // Angle + speed with jitter (all per-tick units)
      const angDeg = MORTAR_ANGLE.angleDeg + (Math.random() * 2 - 1) * MORTAR_ANGLE.angleJitterDeg;
      const ang = (Math.max(10, Math.min(85, angDeg)) * Math.PI) / 180;
      const spd =
        MORTAR_ANGLE.speedPerTick * (1 + (Math.random() * 2 - 1) * MORTAR_ANGLE.speedJitter);

      const vx = Math.cos(ang) * spd * sgn;
      const vy = -Math.sin(ang) * spd; // negative = up (canvas Y-down)

      Body.setVelocity(shell, { x: vx, y: vy });
    }, i * 220);
  }
}

export function tickHoming(dtMs: number): void {
  if (!HOMING_ENABLED) return;
  const dt = Math.max(0.001, dtMs / 1000);

  const maxTurn = HOMING.maxTurnRadPerSec * dt;
  const accel = HOMING.accelPerSec * dt;
  const now = performance.now();

  // iterate a copy so we can splice safely
  for (let i = sim.homing.length - 1; i >= 0; i--) {
    const m = sim.homing[i];
    if (!m || !m.position) {
      sim.homing.splice(i, 1);
      continue;
    }

    const plug = (m as any).plugin ?? {};
    if (plug.ptype !== 'missile') {
      sim.homing.splice(i, 1);
      continue;
    }

    // TTL cleanup
    if (HOMING.ttlMs > 0 && now - (plug.spawnT ?? now) > HOMING.ttlMs) {
      {
        const w = sim.world;
        assertWorld(w);
        World.remove(w, m);
      }
      sim.homing.splice(i, 1);
      continue;
    }

    // Target is the opposing core center
    let target: Vec;
    {
      const tc = plug.side === SIDE.LEFT ? sim.coreR : sim.coreL;
      assertCore(tc);
      target = tc.center;
    }
    const toX = target.x - m.position.x;
    const toY = target.y - m.position.y;
    const toLen = Math.hypot(toX, toY) || 1;
    const desiredAng = Math.atan2(toY, toX);

    // current velocity → angle & speed
    interface Vec {
      x: number;
      y: number;
    }
    type MaybeVelocity = { velocity?: Vec } | null | undefined;
    const v: Vec = (m as MaybeVelocity)?.velocity ?? { x: 0, y: 0 };
    const speed = Math.hypot(v.x, v.y);
    const currAng = speed > 0.001 ? Math.atan2(v.y, v.x) : desiredAng;

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
      {
        const w = sim.world;
        assertWorld(w);
        World.remove(w, m);
      }

      sim.homing.splice(i, 1);
      // (visual pop only; real damage still comes from collisions)
      (sim.fxImp ||= []).push({
        x: target.x,
        y: target.y,
        t0: now,
        ms: 350,
        color: '#ffb700',
        kind: 'burst',
      });
    }
  }
}

// --- tweakables ---
const TOP_Y_FRACTION = 0.13; // unchanged
const OFFSET_FROM_MID_R = 0.8; // unchanged (your value)
const SPACING_R = 0.9; // unchanged (your value)
const EDGE_MARGIN_PX = 24; // unchanged

// NEW: vertical staggering measured in "core radii"
const LASER_Y_OFFSET_R = 0.45; // laser sits lower than cannon by ~0.45R
const MISSILE_Y_OFFSET_R = 0.9; // missile sits lower than cannon by ~0.90R

function coreRadiusFor(side: Side): number {
  const core = side === SIDE.LEFT ? sim.coreL : sim.coreR;
  // Support multiple possible radius field names; fallback to a sensible guess.
  const r = (core as any).outerR ?? (core as any).R ?? (core as any).radius ?? (core as any).ringR;
  return typeof r === 'number' && r > 4 ? r : Math.max(30, sim.H * 0.09);
}

function clampX(x: number): number {
  return Math.min(sim.W - EDGE_MARGIN_PX, Math.max(EDGE_MARGIN_PX, x));
}

// tweakables for bottom artillery
const BOTTOM_Y_FRACTION = 0.88; // vertical row near bottom
const ARTY_X_FROM_MID_R = 0.45; // horizontal offset from midline (in core radii)

interface WeapType {
  pos: {
    x: number;
    y: number;
  };
  mount: Body;
}

export interface WeaponsType {
  cannon: WeapType;
  laser: WeapType;
  missile: WeapType;
  mortar: WeapType;
}

export function makeWeapons(side: Side): WeaponsType {
  const mid = sim.W * 0.5;
  const r = coreRadiusFor(side);
  const sgn = side === SIDE.LEFT ? -1 : +1;

  // Row geometry matches prior hard-coded layout
  const topY = Math.max(36, sim.H * TOP_Y_FRACTION);
  const yByRow = {
    top: (_order: number) => topY,
    bottom: (_order: number) => Math.min(sim.H - 36, sim.H * BOTTOM_Y_FRACTION),
  } as const;

  const baseXTop = mid + sgn * (r * OFFSET_FROM_MID_R);
  const step = r * SPACING_R;
  const xTopByOrder = (order: number) => clampX(baseXTop + sgn * step * order);

  const baseXBottom = mid + sgn * (r * ARTY_X_FROM_MID_R);
  const xBottomByOrder = (order: number) => clampX(baseXBottom + sgn * step * order);

  const mk = (x: number, y: number, label: string): WeapType => {
    const mount = Bodies.circle(x, y, 5, { isStatic: true, isSensor: true });
    (mount as any).plugin = { kind: 'weaponMount', side, label };
    {
      const w = sim.world;
      assertWorld(w);
      World.add(w, mount);
    }
    return { pos: { x, y }, mount };
  };

  // Build mounts from left-side spec, mirroring horizontally by sign
  const specs = WEAPONS_LEFT.filter((s) => s.enabled !== false);

  // Using a small accumulator to hold results by id
  const result: Partial<WeaponsType> = {};

  for (const s of specs) {
    let x = 0;
    let y = 0;
    if (s.row === 'top') {
      // X by order
      x = xTopByOrder(s.order);
      // Y by id-specific stagger to match original visuals
      if (s.id === 'cannon') y = topY;
      else if (s.id === 'laser') y = topY + r * LASER_Y_OFFSET_R;
      else if (s.id === 'missile') y = topY + r * MISSILE_Y_OFFSET_R;
      else y = topY; // fallback
    } else {
      // bottom row (artillery)
      x = xBottomByOrder(s.order);
      y = yByRow.bottom(s.order);
    }

    const placed = mk(x, y, s.id);
    (result as any)[s.id] = placed;
  }

  // Type-safe return (specs are expected to define all four ids)
  return result as WeaponsType;
}
