import { Events, World, Body, Query, Composite } from 'matter-js';

import { EXPLOSION, FX_MS } from '../config';
import { applyCoreDamage } from '../sim/damage';
import { angleToSeg } from '../sim/core';
import { sim } from '../state';
import { SIDE, type Side } from '../types';

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

function explodeAt(x: number, y: number, shooterSide: Side): void {
  if (!EXPLOSION.enabled) return;

  const now = performance.now();
  if (now - _explosionWindowT0 > 1000) {
    _explosionWindowT0 = now;
    _explosionCount = 0;
  }
  if (_explosionCount++ > EXPLOSION.maxPerSec) return;

  const color = shooterSide === SIDE.LEFT ? css('--left') : css('--right');
  (sim.fxImp ||= []).push({ x, y, t0: now, ms: 350, color, kind: 'burst' });

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
  if (bins[key]) bins[key].fill++;
}

function hit(proj: any, coreBody: any, onPostHit?: () => void): void {
  const side: Side = coreBody.plugin.side;
  const coreMaybe = side === SIDE.LEFT ? sim.coreL : sim.coreR;
  assertCoreFull(coreMaybe);
  const core = coreMaybe;
  const dmg = proj?.plugin?.dmg ?? 8;
  const isCenter = coreBody.plugin.kind === 'coreCenter';

  if (((core.shieldHP as number) | 0) > 0) {
    core.shieldHP = Math.max(0, core.shieldHP - dmg);
    const shooterSide = proj?.plugin?.side;
    const color = shooterSide === SIDE.LEFT ? css('--left') : css('--right');
    (sim.fxImp ||= []).push({
      x: proj.position.x,
      y: proj.position.y,
      t0: performance.now(),
      ms: FX_MS.impact,
      color,
      kind: 'burst',
    });
    const w = sim.world;
    assertWorld(w);
    explodeAt(proj.position.x, proj.position.y, proj.plugin.side);
    World.remove(w, proj);
    onPostHit?.();
    return;
  }

  if (isCenter) core.centerHP = Math.max(0, core.centerHP - dmg);
  else applyCoreDamage(core, proj.position, dmg, angleToSeg);

  const ptype = proj?.plugin?.ptype ?? 'cannon';
  const shooterSide = proj?.plugin?.side;
  const color = shooterSide === SIDE.LEFT ? css('--left') : css('--right');
  (sim.fxImp ||= []).push({
    x: proj.position.x,
    y: proj.position.y,
    t0: performance.now(),
    ms: ptype === 'laser' ? FX_MS.burn : FX_MS.impact,
    color,
    kind: ptype === 'laser' ? 'burn' : 'burst',
  });

  const w = sim.world;
  assertWorld(w);
  explodeAt(proj.position.x, proj.position.y, proj.plugin.side);
  World.remove(w, proj);
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
        hit(A, B, opts?.onPostHit);
        continue;
      }
      if (b.kind === 'projectile' && (a.kind === 'coreRing' || a.kind === 'coreCenter')) {
        hit(B, A, opts?.onPostHit);
        continue;
      }

      const explodeIf = (proj: any, other: any): void => {
        const pp = proj?.plugin ?? {};
        if (pp.kind !== 'projectile') return;
        if (other?.plugin?.kind === 'weaponMount') return;
        if (performance.now() - (pp.spawnT ?? 0) < EXPLOSION.graceMs) return;
        explodeAt(proj.position.x, proj.position.y, pp.side);
        const w = sim.world;
        assertWorld(w);
        World.remove(w, proj);
      };

      explodeIf(A, B);
      explodeIf(B, A);
    }
  };

  Events.on(eng, 'collisionStart', onStart);
  return () => Events.off(eng, 'collisionStart', onStart);
}

