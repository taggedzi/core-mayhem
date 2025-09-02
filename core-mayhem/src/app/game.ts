import { Events, World, Body, Query, Composite } from 'matter-js';

import { DEFAULTS } from '../config';
import { COOLDOWN_MS, WEAPON_WINDUP_MS } from '../config';
import { FX_MS } from '../config';
import { EXPLOSION } from '../config';
import { REPAIR_EFFECT } from '../config';
import { GAMEOVER } from '../config';
import { MATCH_LIMIT } from '../config';
import { SHIELD } from '../config';
import { drawFrame } from '../render/draw';
import { updateHUD } from '../render/hud';
import { updateScoreboard } from '../render/score';
import { spawnAmmo, beforeUpdateAmmo } from '../sim/ammo';
import { buildLanes } from '../sim/channels';
import { makeBins, nudgeBinsFromPipes } from '../sim/containers';
import { makeCore, angleToSeg } from '../sim/core';
import { applyCoreDamage } from '../sim/damage';
import { applyGelForces } from '../sim/gel';
import { makePipe, applyPipeForces, addPaddle, tickPaddles, gelRect } from '../sim/obstacles';
import { makePins } from '../sim/pins';
import { tickHoming } from '../sim/weapons';

// --- DEV HOTKEYS: only in Vite dev or if forced via config ---
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
import { applyBuff, applyDebuff } from './mods';
import { attachDevHotkeys } from './devKeys';
import { registerCollisions } from './collisions';

import type { World as MatterWorld, Engine } from 'matter-js';

// --------- local runtime/type asserts (centralized, fail-fast) ----------
interface Vec2 {
  x: number;
  y: number;
}
interface CoreMinimal {
  center: Vec2;
  rot: number;
  rotSpeed: number;
  segHP: number[];
  segHPmax: number;
  centerHP: number;
  centerHPmax: number;
  shieldHP: number;
  shieldHPmax: number;
}
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

// explodeAt moved to app/collisions.ts

export function startGame(canvas: HTMLCanvasElement) {
  clearWorld();
  initWorld(canvas);
  const eng = sim.engine;
  assertEngine(eng);
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
  sim.settings ??= { ...DEFAULTS };

  sim.started = true;
  (sim as any).stats = (sim as any).stats ?? { leftWins: 0, rightWins: 0, ties: 0 };
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

  // Dev hotkeys
  const detachHotkeys = attachDevHotkeys(wepL, wepR);

  // Collisions: deposits + core hits
  const detachCollisions = registerCollisions(eng, { onPostHit: maybeEndMatch });

  // deposit() and hit() moved to app/collisions.ts

  // Game update
  Events.on(eng, 'beforeUpdate', () => {
    const dtMs = sim.engine?.timing?.lastDelta ?? 16.6;
    const dt = dtMs / 1000;
    // stop all game logic once over
    if ((sim as any).gameOver) return;

    // Time-limit: declare a tie if we run too long
    if (MATCH_LIMIT.enabled && MATCH_LIMIT.ms > 0 && !(sim as any).gameOver) {
      const elapsed = performance.now() - ((sim as any).matchStart ?? 0);
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
    const doSide = (side: Side, bins: any, wep: any): void => {
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
  const loop = (): void => {
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

  return function stop() {
    sim.started = false;
    cancelAnimationFrame(raf);
    detachHotkeys?.();
    detachCollisions?.();
    clearWorld();
    updateHUD();
  };
}

function repair(side: Side): void {
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

const css = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function isDead(core: any): boolean {
  return (core?.centerHP | 0) <= 0;
}

function declareWinner(winner: Side | 0): void {
  (sim as any).winner = winner; // 0 = tie
  (sim as any).gameOver = true;
  (sim as any).winnerAt = performance.now();

  const stats = (sim as any).stats ?? ((sim as any).stats = { leftWins: 0, rightWins: 0, ties: 0 });
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

function maybeEndMatch(): void {
  if ((sim as any).gameOver) return;
  const deadL = isDead(sim.coreL);
  const deadR = isDead(sim.coreR);
  if (!deadL && !deadR) return;
  declareWinner(deadL && deadR ? 0 : deadL ? SIDE.RIGHT : SIDE.LEFT);
}
