import { Events, World, Body, Query, Composite } from 'matter-js';

import { DEFAULTS } from '../config';
import { COOLDOWN_MS, WEAPON_WINDUP_MS } from '../config';
// FX and damage handling are now in dedicated modules
import { drawFrame } from '../render/draw';
import { updateHUD } from '../render/hud';
import { updateScoreboard } from '../render/score';
import { buildLanes } from '../sim/channels';
import { makeBins, nudgeBinsFromPipes } from '../sim/containers';
import { makeCore, angleToSeg } from '../sim/core';
import { makePipe, gelRect, addPaddle } from '../sim/obstacles';
import { makePins } from '../sim/pins';

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
import { runPhysics } from './systems/physics';
import { runSpawn } from './systems/spawn';
import { runTriggers } from './systems/triggers';
import { checkTimeLimit, maybeEndMatch } from './systems/match';

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
    // stop all game logic once over
    if ((sim as any).gameOver) return;

    // Time-limit
    checkTimeLimit();

    runPhysics(dtMs);
    runSpawn(dtMs);
    runTriggers();

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

const css = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
// match helpers moved to app/systems/match.ts
