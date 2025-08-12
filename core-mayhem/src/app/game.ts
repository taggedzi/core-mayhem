import { Events, World, Body, Query, Composite } from 'matter-js';

import type { World as MatterWorld, Engine, IEventCollision } from 'matter-js';

import { DEFAULTS } from '../config';
import { COOLDOWN_MS, WEAPON_WINDUP_MS } from '../config';
import { tickHoming } from '../sim/weapons';
import { applyGelForces } from '../sim/gel';
import { drawFrame } from '../render/draw';
import { updateHUD } from '../render/hud';
import { FX_MS } from '../config';
import { EXPLOSION } from '../config';
import { SHOTS_PER_FILL, SHIELD_EFFECT, REPAIR_EFFECT } from '../config';
import { GAMEOVER } from '../config';
import { fireCannon, fireLaser, fireMissiles, fireMortar } from '../sim/weapons';
// --- DEV HOTKEYS: only in Vite dev or if forced via config ---
import { DEV_KEYS } from '../config';
import { applyCoreDamage } from '../sim/damage';
import { ARMOR } from '../config';
import { MATCH_LIMIT } from '../config';
import { MODS } from '../config';
import { SHIELD } from '../config';
import { spawnAmmo, beforeUpdateAmmo } from '../sim/ammo';
import { buildLanes } from '../sim/channels';
import { makeBins, nudgeBinsFromPipes } from '../sim/containers';
import { makeCore, angleToSeg } from '../sim/core';
import { makePipe, applyPipeForces, addPaddle, tickPaddles, gelRect } from '../sim/obstacles';
import { makePins } from '../sim/pins';
import {
  makeWeapons,
  queueFireCannon,
  queueFireLaser,
  queueFireMissiles,
  queueFireMortar,
} from '../sim/weapons';
import { initWorld, clearWorld } from '../sim/world';
import { sim } from '../state';
import { SIDE, type Side } from '../types';

const devKeysOn = import.meta.env?.DEV === true || DEV_KEYS.enabledInProd;

console.log('cooldowns', COOLDOWN_MS);

const nowMs = () => performance.now();
const sideKey = (s: Side) => (s === SIDE.LEFT ? 'L' : 'R');

let _explosionCount = 0,
  _explosionWindowT0 = 0;

export type WeaponKind = 'cannon' | 'laser' | 'missile' | 'mortar';

interface SideMods {
  dmgUntil: number;
  dmgMul: number;
  disableUntil: number;
  disabledType: WeaponKind | null;
}

// --------- local runtime/type asserts (centralized, fail-fast) ----------
type Vec2 = { x: number; y: number };
type CoreMinimal = {
  center: Vec2;
  rot: number;
  rotSpeed: number;
  segHP: number[];
  segHPmax: number;
  centerHP: number;
  centerHPmax: number;
  shieldHP: number;
  shieldHPmax: number;
};
function assertWorld(w: MatterWorld | null): asserts w is MatterWorld {
  if (!w) throw new Error('World not initialized');
}
function assertEngine(e: Engine | null): asserts e is Engine {
  if (!e) throw new Error('Engine not initialized');
}
function assertCore(c: any): asserts c is { center: Vec2 } {
  if (!c || !c.center) throw new Error('Core not initialized');
}
function assertCoreFull(c: any): asserts c is CoreMinimal {
  if (!c || !c.center || !Array.isArray(c.segHP)) throw new Error('Core not initialized');
}

function ensureMods() {
  const anySim = sim as any;
  if (!anySim.modsL)
    anySim.modsL = { dmgUntil: 0, dmgMul: 1, disableUntil: 0, disabledType: null } as SideMods;
  if (!anySim.modsR)
    anySim.modsR = { dmgUntil: 0, dmgMul: 1, disableUntil: 0, disabledType: null } as SideMods;
}

function modsFor(side: Side): SideMods {
  ensureMods();
  return (side === SIDE.LEFT ? (sim as any).modsL : (sim as any).modsR) as SideMods;
}

function modsForOpposite(side: Side): SideMods {
  return modsFor(side === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT);
}

export function currentDmgMul(side: Side): number {
  const m = modsFor(side);
  return performance.now() < m.dmgUntil ? m.dmgMul : 1;
}

export function isDisabled(side: Side, kind: WeaponKind): boolean {
  const m = modsFor(side);
  return performance.now() < m.disableUntil && m.disabledType === kind;
}

export function applyBuff(side: Side) {
  const m = modsFor(side);
  m.dmgMul = MODS.buffMultiplier;
  m.dmgUntil = performance.now() + MODS.buffDurationMs;
}

export function applyDebuff(targetSide: Side, kind: WeaponKind | null = null) {
  const m = modsFor(targetSide);
  const pool = MODS.allowedDebuffs;
  let k: WeaponKind | null = kind;
  if (k === null) {
    if (pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      k = pool[idx] ?? null; // idx < length, but TS still allows undefined; coalesce to null
    } else {
      k = null;
    }
  }
  m.disabledType = k;
  m.disableUntil = performance.now() + MODS.debuffDurationMs;
}

function explodeAt(x: number, y: number, baseDmg: number, shooterSide: Side) {
  if (!EXPLOSION.enabled) return;

  // rate limit
  const now = performance.now();
  if (now - _explosionWindowT0 > 1000) {
    _explosionWindowT0 = now;
    _explosionCount = 0;
  }
  if (_explosionCount++ > EXPLOSION.maxPerSec) return;

  // FX (burst)
  const color = shooterSide === SIDE.LEFT ? css('--left') : css('--right');
  (sim.fxImp ||= []).push({ x, y, t0: now, ms: 350, color, kind: 'burst' });

  // query nearby & push
  const r = EXPLOSION.radius;
  const aabb = { min: { x: x - r, y: y - r }, max: { x: x + r, y: y + r } };
  {
    const w = sim.world;
    assertWorld(w);
    var bodies = Query.region(Composite.allBodies(w), aabb);
  }

  for (const b of bodies) {
    const plug = (b as any).plugin || {};
    // Push ammo & projectiles away
    if (plug.kind === 'ammo' || plug.kind === 'projectile') {
      const dx = b.position.x - x,
        dy = b.position.y - y;
      const dist = Math.max(6, Math.hypot(dx, dy));
      const k = EXPLOSION.force / dist;
      Body.applyForce(b, b.position, { x: dx * k * b.mass, y: dy * k * b.mass });

      // Optional: destroy ammo with probability
      if (plug.kind === 'ammo' && Math.random() < EXPLOSION.ammoDestroyPct) {
        {
          const w = sim.world;
          assertWorld(w);
          World.remove(w, b);
        }
        if (plug.side === SIDE.LEFT) sim.ammoL = Math.max(0, sim.ammoL - 1);
        else if (plug.side === SIDE.RIGHT) sim.ammoR = Math.max(0, sim.ammoR - 1);
      }
    }
  }
}

export function startGame(canvas: HTMLCanvasElement) {
  clearWorld();
  initWorld(canvas);
  const eng = sim.engine;
  assertEngine(eng);
  ensureMods(); // (creates modsL/modsR with defaults)
  (sim as any).cooldowns = {
    L: { cannon: 0, laser: 0, missile: 0, mortar: 0 },
    R: { cannon: 0, laser: 0, missile: 0, mortar: 0 },
  };
  (sim as any).fxArm = []; // wind-up ring FX store
  (sim as any).fxBeam = []; // laser beams store
  (sim as any).fxImp = []; // impact/burn FX store
  (sim as any).fxSweep = []; // missile sweep pointer FX store
  (sim as any).homing = []; // missiles to home

  // Only seed settings once; keep whatever was already configured between runs
  if (!sim.settings) sim.settings = { ...DEFAULTS };

  sim.started = true;
  (sim as any).stats = (sim as any).stats || { leftWins: 0, rightWins: 0, ties: 0 };
  updateScoreboard(); // draw initial 0–0

  if ((sim as any).restartTO) {
    clearTimeout((sim as any).restartTO);
    (sim as any).restartTO = 0;
  }
  (sim as any).gameOver = false;
  (sim as any).winner = null;
  (sim as any).winnerAt = 0;
  (sim as any).matchStart = performance.now(); // ⬅️ stamp match start

  // Edge pipes
  const pipeL = makePipe(SIDE.LEFT);
  const pipeR = makePipe(SIDE.RIGHT);
  sim.pipes = [pipeL, pipeR];

  // Layout
  const pinsL = makePins(SIDE.LEFT, { anchor: pipeL.innerX });
  const pinsR = makePins(SIDE.RIGHT, { anchor: pipeR.innerX });
  sim.binsL = makeBins(SIDE.LEFT, pinsL.mid, pinsL.width);
  sim.binsR = makeBins(SIDE.RIGHT, pinsR.mid, pinsR.width);
  // push bins away from pipe inner wall by 5px
  nudgeBinsFromPipes(SIDE.LEFT, sim.binsL, 5);
  nudgeBinsFromPipes(SIDE.RIGHT, sim.binsR, 5);

  gelRect(pinsL.mid, sim.H * 0.14, pinsL.width * 0.96, Math.max(36, sim.H * 0.06), {
    dampX: 2.2,
    dampY: 3.2,
  });
  gelRect(pinsR.mid, sim.H * 0.14, pinsR.width * 0.96, Math.max(36, sim.H * 0.06), {
    dampX: 2.2,
    dampY: 3.2,
  });

  {
    const w = sim.world;
    assertWorld(w);
    sim.coreL = makeCore(w as any, SIDE.LEFT, css('--left'));
  }
  {
    const w = sim.world;
    assertWorld(w);
    sim.coreR = makeCore(w as any, SIDE.RIGHT, css('--right'));
  }

  // Top gel + splitter + funnels
  {
    const w = sim.world;
    assertWorld(w);
    buildLanes(w, pinsL.mid, pinsL.width);
  }
  {
    const w = sim.world;
    assertWorld(w);
    buildLanes(w, pinsR.mid, pinsR.width);
  }

  // Shaker bars
  addPaddle(pinsL.mid - pinsL.width * 0.2, sim.H * 0.6, 28, 1.2, +1);
  addPaddle(pinsL.mid + pinsL.width * 0.2, sim.H * 0.6, 28, 1.2, -1);
  addPaddle(pinsR.mid - pinsR.width * 0.2, sim.H * 0.6, 28, 1.2, +1);
  addPaddle(pinsR.mid + pinsR.width * 0.2, sim.H * 0.6, 28, 1.2, -1);

  // Weapons (positions are computed; firing happens on bin fill)
  const wepL = makeWeapons(SIDE.LEFT);
  const wepR = makeWeapons(SIDE.RIGHT);
  (sim as any).wepL = wepL;
  (sim as any).wepR = wepR;

  if (devKeysOn) {
    const onKey = (e: KeyboardEvent) => {
      if ((sim as any).gameOver) return;

      // helpers
      const L = SIDE.LEFT,
        R = SIDE.RIGHT;
      const cLCore = sim.coreL;
      assertCore(cLCore);
      const cRCore = sim.coreR;
      assertCore(cRCore);
      const cL = cLCore.center,
        cR = cRCore.center;

      switch (e.key) {
        // Left side (lowercase)
        case 'c':
          fireCannon(L, (wepL as any).cannon.pos, cR, /*speedOrDmg?*/ 16);
          break;
        case 'l':
          {
            const tc = sim.coreR;
            assertCore(tc);
            fireLaser(L, (wepL as any).laser.pos, tc);
          }
          break;
        case 'm':
          fireMissiles(L, (wepL as any).missile.pos, 5 /*count*/);
          break;
        case 'o':
          fireMortar(L, (wepL as any).mortar.pos, 3 /*count*/);
          break;

        // Right side (uppercase)
        case 'C':
          fireCannon(R, (wepR as any).cannon.pos, cL, 16);
          break;
        case 'L':
          {
            const tc = sim.coreL;
            assertCore(tc);
            fireLaser(R, (wepR as any).laser.pos, tc);
          }
          break;
        case 'M':
          fireMissiles(R, (wepR as any).missile.pos, 5);
          break;
        case 'O':
          fireMortar(R, (wepR as any).mortar.pos, 3);
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    // Remove on stop so we don't stack listeners across restarts
    (sim as any)._devKeyHandler = onKey;
  }

  // Collisions: deposits + core hits
  Events.on(eng, 'collisionStart', (e: IEventCollision<Engine>) => {
    for (const p of e.pairs) {
      const A = p.bodyA as any,
        B = p.bodyB as any;
      const a = A.plugin || {},
        b = B.plugin || {};

      // deposits (unchanged)
      if (a.kind === 'ammo' && b.kind === 'container') {
        deposit(A, B);
        continue;
      }
      if (b.kind === 'ammo' && a.kind === 'container') {
        deposit(B, A);
        continue;
      }

      // direct core hits (apply damage + FX; we also explode below inside hit())
      if (a.kind === 'projectile' && (b.kind === 'coreRing' || b.kind === 'coreCenter')) {
        hit(A, B);
        continue;
      }
      if (b.kind === 'projectile' && (a.kind === 'coreRing' || a.kind === 'coreCenter')) {
        hit(B, A);
        continue;
      }

      // explode-on-anything (except mounts) with grace period
      const explodeIf = (proj: any, other: any) => {
        const pp = proj?.plugin || {};
        if (pp.kind !== 'projectile') return;
        if (other?.plugin?.kind === 'weaponMount') return; // ignore mounts
        if (performance.now() - (pp.spawnT || 0) < EXPLOSION.graceMs) return; // grace

        explodeAt(proj.position.x, proj.position.y, pp.dmg || 8, pp.side);
        {
          const w = sim.world;
          assertWorld(w);
          World.remove(w, proj);
        }
      };

      // pop if projectile touches anything (ammo, pins, walls, containers, beamSensor, etc.)
      explodeIf(A, B);
      explodeIf(B, A);
    }
  });

  function deposit(ammo: any, container: any) {
    const accept = container.plugin.accept as string[];
    if (!accept.includes(ammo.plugin.type)) return;
    {
      const w = sim.world;
      assertWorld(w);
      World.remove(w, ammo);
    }
    ammo.plugin.side === SIDE.LEFT ? sim.ammoL-- : sim.ammoR--;
    const bins = (container.plugin.side === SIDE.LEFT ? sim.binsL : sim.binsR) as any;
    const key = container.plugin.label as string;
    if (bins[key]) bins[key].fill++;
  }

  function hit(proj: any, coreBody: any) {
    const side: Side = coreBody.plugin.side; // the side being hit
    const coreMaybe = side === SIDE.LEFT ? sim.coreL : sim.coreR;
    assertCoreFull(coreMaybe);
    const core = coreMaybe;
    const dmg = proj?.plugin?.dmg || 8;
    const isCenter = coreBody.plugin.kind === 'coreCenter';

    // --- ABLATIVE SHIELD: if any shieldHP remains, it absorbs projectile damage ---
    if (((core.shieldHP as number) | 0) > 0) {
      core.shieldHP = Math.max(
        0,
        core.shieldHP - dmg /* * SHIELD.projectileFactor if you added it */,
      );

      // FX for shield hit (nice pop)
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

      explodeAt(proj.position.x, proj.position.y, dmg, proj.plugin.side);
      {
        const w = sim.world;
        assertWorld(w);
        World.remove(w, proj);
      }
      maybeEndMatch();
      return;
    }

    // --- No shield: apply to core as before ---
    if (isCenter) {
      core.centerHP = Math.max(0, core.centerHP - dmg);
    } else {
      applyCoreDamage(core, proj.position, dmg, angleToSeg);
    }

    // impact/burn FX + explode
    const ptype = proj?.plugin?.ptype || 'cannon';
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

    explodeAt(proj.position.x, proj.position.y, dmg, proj.plugin.side);
    {
      const w = sim.world;
      assertWorld(w);
      World.remove(w, proj);
    }
    maybeEndMatch();
  }

  // Game update
  Events.on(eng, 'beforeUpdate', () => {
    const dtMs = sim.engine?.timing?.lastDelta ?? 16.6;
    const dt = dtMs / 1000;
    // stop all game logic once over
    if ((sim as any).gameOver) return;

    // Time-limit: declare a tie if we run too long
    if (MATCH_LIMIT.enabled && MATCH_LIMIT.ms > 0 && !(sim as any).gameOver) {
      const elapsed = performance.now() - ((sim as any).matchStart || 0);
      if (elapsed >= MATCH_LIMIT.ms) {
        // 0 means tie; this will show the banner and schedule auto-restart
        declareWinner(0);
      }
    }

    beforeUpdateAmmo();
    applyGelForces();
    applyPipeForces(sim.pipes);
    tickPaddles(dt);
    tickHoming(dtMs);

    // soft target spawn
    sim.spawnAcc += dtMs;
    const stg = (sim as any).settings ?? DEFAULTS;
    const per = 1000 / stg.spawnRate;
    const softMin = stg.targetAmmo * 0.75,
      softMax = stg.targetAmmo * 1.25;
    while (sim.spawnAcc > per) {
      sim.spawnAcc -= per;
      if (sim.ammoL < softMax) {
        if (sim.ammoL < softMin) {
          spawnAmmo(SIDE.LEFT);
          spawnAmmo(SIDE.LEFT);
        } else spawnAmmo(SIDE.LEFT);
      }
      if (sim.ammoR < softMax) {
        if (sim.ammoR < softMin) {
          spawnAmmo(SIDE.RIGHT);
          spawnAmmo(SIDE.RIGHT);
        } else spawnAmmo(SIDE.RIGHT);
      }
    }

    // bin triggers
    const doSide = (side: Side, bins: any, wep: any) => {
      const key = side === SIDE.LEFT ? 'L' : 'R';
      const color = side === SIDE.LEFT ? css('--left') : css('--right');
      const now = performance.now();

      // --- inside doSide(side, bins, wep) ---
      if (bins.buff && bins.buff.fill >= bins.buff.cap) {
        bins.buff.fill = 0;
        applyBuff(side); // buff your own side
      }
      if (bins.debuff && bins.debuff.fill >= bins.debuff.cap) {
        bins.debuff.fill = 0;
        applyDebuff(side === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT); // debuff the other side
      }

      if (bins.cannon.fill >= bins.cannon.cap && now >= sim.cooldowns[key].cannon) {
        bins.cannon.fill = 0;
        sim.cooldowns[key].cannon = now + COOLDOWN_MS.cannon;
        sim.fxArm.push({
          x: wep.cannon.pos.x,
          y: wep.cannon.pos.y,
          until: now + WEAPON_WINDUP_MS,
          color,
        });
        {
          const tc = side === SIDE.LEFT ? sim.coreR : sim.coreL;
          assertCore(tc);
          queueFireCannon(side, wep.cannon.pos, tc.center);
        }
      }

      if (bins.laser.fill >= bins.laser.cap && now >= sim.cooldowns[key].laser) {
        bins.laser.fill = 0;
        sim.cooldowns[key].laser = now + COOLDOWN_MS.laser;
        sim.fxArm.push({
          x: wep.laser.pos.x,
          y: wep.laser.pos.y,
          until: now + WEAPON_WINDUP_MS,
          color,
        });
        {
          const tc = side === SIDE.LEFT ? sim.coreR : sim.coreL;
          assertCore(tc);
          queueFireLaser(side, wep.laser.pos, tc);
        }
      }

      if (bins.missile.fill >= bins.missile.cap && now >= sim.cooldowns[key].missile) {
        bins.missile.fill = 0;
        sim.cooldowns[key].missile = now + COOLDOWN_MS.missile;
        sim.fxArm.push({
          x: wep.missile.pos.x,
          y: wep.missile.pos.y,
          until: now + WEAPON_WINDUP_MS,
          color,
        });
        queueFireMissiles(side, wep.missile.pos);
      }

      if (bins.mortar.fill >= bins.mortar.cap && now >= sim.cooldowns[key].mortar) {
        bins.mortar.fill = 0;
        sim.cooldowns[key].mortar = now + COOLDOWN_MS.mortar;
        sim.fxArm.push({
          x: wep.mortar.pos.x,
          y: wep.mortar.pos.y,
          until: now + WEAPON_WINDUP_MS,
          color,
        });
        queueFireMortar(side, wep.mortar.pos);
      }

      if (bins.repair.fill >= bins.repair.cap) {
        bins.repair.fill = 0;
        repair(side); // uses REPAIR_EFFECT below
      }

      if (bins.shield.fill >= bins.shield.cap) {
        bins.shield.fill = 0;
        {
          const core = side === SIDE.LEFT ? sim.coreL : sim.coreR;
          assertCoreFull(core);
          core.shieldHP = Math.min(core.shieldHPmax, core.shieldHP + SHIELD.onPickup);
        }
      }
    };
    doSide(SIDE.LEFT, sim.binsL, wepL);
    doSide(SIDE.RIGHT, sim.binsR, wepR);

    {
      const cL = sim.coreL;
      assertCoreFull(cL);
      cL.rot += cL.rotSpeed;
    }
    {
      const cR = sim.coreR;
      assertCoreFull(cR);
      cR.rot += cR.rotSpeed;
    }

    // did someone die this frame?
    maybeEndMatch();
  });

  // Render loop
  const ctx = canvas.getContext('2d')!;
  let raf = 0,
    frames = 0,
    fpsTimer = performance.now();
  const loop = () => {
    drawFrame(ctx);
    updateHUD();
    const now = performance.now();
    frames++;
    if (now - fpsTimer > 500) {
      const fpsVal = Math.round((frames * 1000) / (now - fpsTimer));
      document.getElementById('fps')!.textContent = String(fpsVal);
      fpsTimer = now;
      frames = 0;
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  console.assert(typeof WEAPON_WINDUP_MS === 'number', 'WEAPON_WINDUP_MS missing');
  console.assert(COOLDOWN_MS && typeof COOLDOWN_MS.cannon === 'number', 'COOLDOWN_MS missing');
  return function stop() {
    sim.started = false;
    cancelAnimationFrame(raf);
    clearWorld();
    updateHUD();
  };
}

function repair(side: Side) {
  const coreMaybe = side === SIDE.LEFT ? sim.coreL : sim.coreR;
  assertCoreFull(coreMaybe);
  const core = coreMaybe;
  // heal N weakest segments
  for (let k = 0; k < REPAIR_EFFECT.segmentsToHeal; k++) {
    let idx = 0,
      min = 1e9;
    for (let i = 0; i < core.segHP.length; i++) {
      const hp = core.segHP[i] ?? 0;
      if (hp < min) {
        min = hp;
        idx = i;
      }
    }
    const cur = core.segHP[idx] ?? 0;
    core.segHP[idx] = Math.min(core.segHPmax, cur + REPAIR_EFFECT.segHealAmount);
  }
  // occasional center repair
  if (Math.random() < REPAIR_EFFECT.centerChance) {
    core.centerHP = Math.min(core.centerHPmax, core.centerHP + REPAIR_EFFECT.centerAmount);
  }
}

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function isDead(core: any) {
  return (core?.centerHP | 0) <= 0;
}

function declareWinner(winner: Side | 0) {
  (sim as any).winner = winner; // 0 = tie
  (sim as any).gameOver = true;
  (sim as any).winnerAt = performance.now();

  const stats = (sim as any).stats || ((sim as any).stats = { leftWins: 0, rightWins: 0, ties: 0 });
  if (winner === -1) stats.leftWins++;
  else if (winner === 1) stats.rightWins++;
  else stats.ties++;

  updateScoreboard();

  // Schedule auto-restart (once)
  if (GAMEOVER.autoRestart && !(sim as any).restartTO) {
    (sim as any).restartTO = setTimeout(() => {
      // tell main.ts to stop+start
      window.dispatchEvent(new CustomEvent('coreMayhem:restart'));
      (sim as any).restartTO = 0;
    }, GAMEOVER.bannerMs);
  }
}

function maybeEndMatch() {
  if ((sim as any).gameOver) return;
  const deadL = isDead(sim.coreL);
  const deadR = isDead(sim.coreR);
  if (!deadL && !deadR) return;
  declareWinner(deadL && deadR ? 0 : deadL ? SIDE.RIGHT : SIDE.LEFT);
}

function updateScoreboard() {
  const el = document.getElementById('score');
  if (!el) return;
  const s = (sim as any).stats || { leftWins: 0, rightWins: 0, ties: 0 };
  const lWins = s.leftWins | 0,
    rWins = s.rightWins | 0,
    ties = s.ties | 0;

  // losses are the opponent's wins
  const lLoss = rWins,
    rLoss = lWins;

  // Build inner HTML to keep colored tags
  el.innerHTML = `
    <span class="left tag">LEFT</span> ${lWins}–${lLoss}
    ${ties ? `<span class="sep">|</span> T:${ties} <span class="sep">|</span>` : `<span class="sep">|</span>`}
    <span class="right tag">RIGHT</span> ${rWins}–${rLoss}
  `;
}
