import { Events, World, Body, Query, Composite } from 'matter-js';

import { EXPLOSION, FX_MS, PROJECTILE_STYLE } from '../config';
import { angleToSeg } from '../sim/core';
import { applyCoreDamage } from '../sim/damage';
import { sim } from '../state';
import { SIDE, type Side } from '../types';

import { currentBinFillMul } from './mods';
import { recordBinDeposit, recordProjectileHit, recordMiss } from './stats';
import { recordMissileFirstImpact, recordMissileCoreDelay } from './stats';

import type { Engine, IEventCollision, World as MatterWorld } from 'matter-js';

// local asserts
function assertWorld(w: MatterWorld | null): asserts w is MatterWorld {
  if (!w) throw new Error('World not initialized');
}
function assertCoreFull(c: any): asserts c is {
  center: { x: number; y: number };
  segHP: number[];
  segHPmax: number;
  centerHP: number;
  centerHPmax: number;
  shieldHP: number;
  shieldHPmax: number;
} {
  if (!c || !c.center || !Array.isArray(c.segHP)) throw new Error('Core not initialized');
}

const css = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

let _explosionCount = 0;
let _explosionWindowT0 = 0;

function explodeAt(
  x: number,
  y: number,
  shooterSide: Side,
  colorOverride?: string,
  power?: number,
): void {
  if (!EXPLOSION.enabled) return;

  const now = performance.now();
  if (now - _explosionWindowT0 > 1000) {
    _explosionWindowT0 = now;
    _explosionCount = 0;
  }
  if (_explosionCount++ > EXPLOSION.maxPerSec) return;

  const color = colorOverride ?? (shooterSide === SIDE.LEFT ? css('--left') : css('--right'));
  (sim.fxImp ||= []).push({ x, y, t0: now, ms: 350, color, kind: 'burst', power });
  // camera shake + sparks
  (sim as any).shakeT0 = now;
  (sim as any).shakeMs = 220;
  (sim as any).shakeAmp = Math.max(2, Math.min(8, (sim as any).shakeAmp ?? 0 + 3));
  const sparks = (sim as any).fxSparks || ((sim as any).fxSparks = []);
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1.6 + Math.random() * 3.2;
    sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t0: now, ms: 600 + Math.random() * 400, color });
  }

  const r = EXPLOSION.radius;
  const aabb = { min: { x: x - r, y: y - r }, max: { x: x + r, y: y + r } };
  const w = sim.world;
  assertWorld(w);
  const bodies = Query.region(Composite.allBodies(w), aabb);

  for (const b of bodies) {
    const plug = (b as any).plugin ?? {};
    if (plug.kind === 'ammo' || plug.kind === 'projectile') {
      const dx = b.position.x - x,
        dy = b.position.y - y;
      const dist = Math.max(6, Math.hypot(dx, dy));
      const k = EXPLOSION.force / dist;
      Body.applyForce(b, b.position, { x: dx * k * b.mass, y: dy * k * b.mass });

      if (plug.kind === 'ammo' && Math.random() < EXPLOSION.ammoDestroyPct) {
        World.remove(w, b);
        if (plug.side === SIDE.LEFT) sim.ammoL = Math.max(0, sim.ammoL - 1);
        else if (plug.side === SIDE.RIGHT) sim.ammoR = Math.max(0, sim.ammoR - 1);
      }
    }
  }
}

function deposit(ammo: any, container: any): void {
  const accept = container.plugin.accept as string[];
  if (!accept.includes(ammo.plugin.type)) return;
  const w = sim.world;
  assertWorld(w);
  World.remove(w, ammo);
  if (ammo.plugin.side === SIDE.LEFT) sim.ammoL--;
  else sim.ammoR--;
  const bins = (container.plugin.side === SIDE.LEFT ? sim.binsL : sim.binsR) as any;
  const key = container.plugin.label as string;
  if (bins[key]) {
    const add = Math.max(1, Math.round(currentBinFillMul(container.plugin.side)));
    bins[key].fill += add;
    // stats: deposit event
    try {
      recordBinDeposit(container.plugin.side, key as any, add);
    } catch {
      /* ignore */ void 0;
    }
    if (add > 1) {
      (bins[key] as any)._fxLastAdd = add;
      (bins[key] as any)._fxT0 = performance.now();
    }
  }
}

function hit(proj: any, coreBody: any, onPostHit?: () => void): void {
  const side: Side = coreBody.plugin.side;
  const coreMaybe = side === SIDE.LEFT ? sim.coreL : sim.coreR;
  assertCoreFull(coreMaybe);
  const core = coreMaybe;
  let dmg = proj?.plugin?.dmg ?? 8;
  const isCenter = coreBody.plugin.kind === 'coreCenter';

  // Treat tiny fractional remnants as zero to avoid "stuck" shield visuals
  const SHIELD_EPS = 1e-3;
  if ((core.shieldHP as number) > SHIELD_EPS) {
    // Allow excess to penetrate instead of being lost when the shot breaks the shield
    const shieldBefore = core.shieldHP as number;
    core.shieldHP = Math.max(0, shieldBefore - dmg);
    if (core.shieldHP < SHIELD_EPS) core.shieldHP = 0;
    const excess = Math.max(0, dmg - shieldBefore);

    const shooterSide = proj?.plugin?.side;
    const ptype = String(proj?.plugin?.ptype ?? 'cannon');
    const sty = (PROJECTILE_STYLE as any)[ptype];
    const color = sty?.glow ?? (shooterSide === SIDE.LEFT ? css('--left') : css('--right'));

    // Always show an impact burst on the shield surface
    (sim.fxImp ||= []).push({
      x: proj.position.x,
      y: proj.position.y,
      t0: performance.now(),
      ms: FX_MS.impact,
      color,
      kind: 'burst',
      power: Number(dmg) || undefined,
    });

    const w = sim.world;
    assertWorld(w);
    explodeAt(proj.position.x, proj.position.y, proj.plugin.side, color, Number(dmg) || undefined);

    if (excess <= 0) {
      // Shot fully absorbed by the shield
      try {
        recordProjectileHit(proj?.plugin?.side, proj?.plugin?.ptype ?? 'cannon', shieldBefore - core.shieldHP, 0, 0);
        proj.plugin.didDamage = true;
      } catch { /* ignore */ void 0; }
      World.remove(w, proj);
      onPostHit?.();
      return;
    }
    // Fall through to apply remaining damage to the core below
    dmg = excess;
  }

  // Snapshot before
  const segBefore = core.segHP.reduce((a, b) => a + (b | 0), 0);
  const centerBefore = core.centerHP | 0;
  if (isCenter) core.centerHP = Math.max(0, core.centerHP - dmg);
  else applyCoreDamage(core, proj.position, dmg, angleToSeg);
  const segAfter = core.segHP.reduce((a, b) => a + (b | 0), 0);
  const centerAfter = core.centerHP | 0;
  try {
    recordProjectileHit(
      proj?.plugin?.side,
      proj?.plugin?.ptype ?? 'cannon',
      0,
      Math.max(0, segBefore - segAfter),
      Math.max(0, centerBefore - centerAfter),
    );
    proj.plugin.didDamage = true;
    // Diagnostics: time from missile spawn to first core damage
    try {
      if (proj?.plugin?.ptype === 'missile' && proj?.plugin && !proj?.plugin?._coreHitLogged) {
        const t0 = Number(proj.plugin.spawnT ?? performance.now());
        const ms = Math.max(0, Math.round(performance.now() - t0));
        recordMissileCoreDelay(proj.plugin.side, ms);
        proj.plugin._coreHitLogged = true;
      }
    } catch {
      /* ignore */ void 0;
    }
  } catch {
    /* ignore */ void 0;
  }

  const ptype = proj?.plugin?.ptype ?? 'cannon';
  const shooterSide = proj?.plugin?.side;
  const sty = (PROJECTILE_STYLE as any)[String(ptype)];
  const color = sty?.glow ?? (shooterSide === SIDE.LEFT ? css('--left') : css('--right'));
  (sim.fxImp ||= []).push({
    x: proj.position.x,
    y: proj.position.y,
    t0: performance.now(),
    ms: ptype === 'laser' ? FX_MS.burn : FX_MS.impact,
    color,
    kind: ptype === 'laser' ? 'burn' : 'burst',
    power: Number(dmg) || undefined,
  });

  const w = sim.world;
  assertWorld(w);
  const ringColor2 = sty?.glow ?? (shooterSide === SIDE.LEFT ? css('--left') : css('--right'));
  explodeAt(proj.position.x, proj.position.y, proj.plugin.side, ringColor2, Number(dmg) || undefined);
  World.remove(w, proj);
  // minor shake for direct hits
  (sim as any).shakeT0 = performance.now();
  (sim as any).shakeMs = 160;
  (sim as any).shakeAmp = Math.max(2, Math.min(6, (sim as any).shakeAmp ?? 0 + 2));
  onPostHit?.();
}

export function registerCollisions(
  eng: Engine,
  opts?: { onPostHit?: () => void },
): () => void {
  const onStart = (e: IEventCollision<Engine>): void => {
    for (const p of e.pairs) {
      const A = p.bodyA as any,
        B = p.bodyB as any;
      const a = A.plugin ?? {},
        b = B.plugin ?? {};

      if (a.kind === 'ammo' && b.kind === 'container') {
        deposit(A, B);
        continue;
      }
      if (b.kind === 'ammo' && a.kind === 'container') {
        deposit(B, A);
        continue;
      }

      if (a.kind === 'projectile' && (b.kind === 'coreRing' || b.kind === 'coreCenter')) {
        // First impact kind (diagnostic)
        try {
          const plug = (A as any).plugin ?? {};
          if (plug.ptype === 'missile' && !plug._firstImpactKind) {
            plug._firstImpactKind = b.kind;
            recordMissileFirstImpact(plug.side, String(b.kind));
          }
        } catch {
          /* ignore */ void 0;
        }
        // Avoid double-processing the same projectile if already handled
        if (!(A as any)?.plugin?.didDamage) hit(A, B, opts?.onPostHit);
        continue;
      }
      if (b.kind === 'projectile' && (a.kind === 'coreRing' || a.kind === 'coreCenter')) {
        try {
          const plug = (B as any).plugin ?? {};
          if (plug.ptype === 'missile' && !plug._firstImpactKind) {
            plug._firstImpactKind = a.kind;
            recordMissileFirstImpact(plug.side, String(a.kind));
          }
        } catch {
          /* ignore */ void 0;
        }
        if (!(B as any)?.plugin?.didDamage) hit(B, A, opts?.onPostHit);
        continue;
      }

  const explodeIf = (proj: any, other: any): void => {
    const pp = proj?.plugin ?? {};
    if (pp.kind !== 'projectile') return;
    if (other?.plugin?.kind === 'weaponMount') return;
    if (performance.now() - (pp.spawnT ?? 0) < EXPLOSION.graceMs) return;
    // Record first impact kind for missiles if not already recorded
    try {
      if (pp.ptype === 'missile' && !pp._firstImpactKind) {
        const k = String(other?.plugin?.kind ?? 'unknown');
        pp._firstImpactKind = k;
        recordMissileFirstImpact(pp.side, k);
      }
    } catch {
      /* ignore */ void 0;
    }
        const ptype = String(pp.ptype ?? 'cannon');
        const sty = (PROJECTILE_STYLE as any)[ptype];
        const ringColor = sty?.glow ?? (pp.side === SIDE.LEFT ? css('--left') : css('--right'));
    explodeAt(proj.position.x, proj.position.y, pp.side, ringColor, Number(pp.dmg) || undefined);
    const w = sim.world;
    assertWorld(w);
    World.remove(w, proj);
    // count miss if no damage was recorded
    try {
      if (!pp.didDamage) recordMiss(pp.side, pp.ptype ?? 'cannon');
    } catch {
      /* ignore */ void 0;
    }
  };

      explodeIf(A, B);
      explodeIf(B, A);
    }
  };

  Events.on(eng, 'collisionStart', onStart);
  return () => Events.off(eng, 'collisionStart', onStart);
}
