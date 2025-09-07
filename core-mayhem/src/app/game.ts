import { Events, Body, Composite } from 'matter-js';

import { DEFAULTS } from '../config';
// FX and damage handling are now in dedicated modules
import { drawFrame } from '../render/draw';
import { updateHUD } from '../render/hud';
import { updateScoreboard } from '../render/score';
import { buildLanes } from '../sim/channels';
import { makeBins, nudgeBinsFromPipes } from '../sim/containers';
import { makeCore } from '../sim/core';
import { makePipe, placeObstaclesFromSpecs } from '../sim/obstacles';
import { makePins } from '../sim/pins';
// --- DEV HOTKEYS: only in Vite dev or if forced via config ---
import { makeWeapons } from '../sim/weapons';
import { initWorld, clearWorld } from '../sim/world';
import { sim } from '../state';
import { SIDE } from '../types';

// import { applyBuff, applyDebuff } from './mods';
import { registerCollisions } from './collisions';
import { attachDevHotkeys } from './devKeys';
import { startNewMatch } from './stats';
import { runFXPrune } from './systems/fx';
import { checkTimeLimit, maybeEndMatch } from './systems/match';
import { runPhysics } from './systems/physics';
import { runSpawn } from './systems/spawn';
import { runTriggers } from './systems/triggers';

import type { World as MatterWorld, Engine } from 'matter-js';

// --------- local runtime/type asserts (centralized, fail-fast) ----------
// local Vec2 interface removed (unused)
function assertWorld(w: MatterWorld | null): asserts w is MatterWorld {
  if (!w) throw new Error('World not initialized');
}
function assertEngine(e: Engine | null): asserts e is Engine {
  if (!e) throw new Error('Engine not initialized');
}
// local asserts kept for potential future use were removed to satisfy TS unused rules

// explodeAt moved to app/collisions.ts

export function startGame(canvas: HTMLCanvasElement): () => void {
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
  // Diagnostics counters
  (sim as any).tick = 0;
  (sim as any).matchIndex = ((sim as any).matchIndex | 0) + 1;
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
  // Start a new stats match session
  startNewMatch();

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

  // Spec-driven gels and paddles (mirrored like bins)
  placeObstaclesFromSpecs(SIDE.LEFT, pinsL.mid, pinsL.width);
  placeObstaclesFromSpecs(SIDE.RIGHT, pinsR.mid, pinsR.width);

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

  // paddles now placed via specs above

  // Weapons (positions are computed; firing happens on bin fill)
  const wepL = makeWeapons(SIDE.LEFT);
  const wepR = makeWeapons(SIDE.RIGHT);
  sim.wepL = wepL;
  sim.wepR = wepR;

  // Optional: mirror arena geometry horizontally (diagnostic)
  try { maybeMirrorArena(); } catch { /* ignore */ void 0; }

  // Dev hotkeys
  const detachHotkeys = attachDevHotkeys(wepL, wepR);

  // Collisions: deposits + core hits
  const detachCollisions = registerCollisions(eng, { onPostHit: maybeEndMatch });

  // deposit() and hit() moved to app/collisions.ts

  // Game update
  Events.on(eng, 'beforeUpdate', (): void => {
    // tick counter for alternate order testing
    (sim as any).tick = ((sim as any).tick | 0) + 1;
    const dtMs = sim.engine?.timing?.lastDelta ?? 16.6;
    // stop all game logic once over
    if ((sim as any).gameOver) return;

    // Time-limit
    checkTimeLimit();

    // Apply configurable time scale (slow down/speed up sim)
    const stg = (sim as any).settings ?? DEFAULTS;
    const scaled = dtMs * (stg.timescale ?? 1);

    runPhysics(scaled);
    runFXPrune(performance.now());
    runSpawn(scaled);
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

  return function stop(): void {
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

// --- Diagnostics helper: mirror all world bodies and known positions across vertical center ---
function maybeMirrorArena(): void {
  const stg = (sim as any).settings ?? DEFAULTS;
  if (!stg?.mirrorArena) return;
  const wld = sim.world as any;
  if (!wld) return;
  const W = sim.W;
  const bodies = Composite.allBodies(wld);
  // Prefer using Matter namespaces if available in this module
  // Fallback: scan known bodies by hand if Composite is not in scope
  const all: any[] = Array.isArray(bodies) && bodies.length ? bodies : [];
  for (const b of all) {
    const x = b?.position?.x;
    const y = b?.position?.y;
    if (typeof x === 'number' && typeof y === 'number') Body.setPosition(b, { x: W - x, y });
  }
  // Core centers
  if (sim.coreL?.center) sim.coreL.center.x = W - sim.coreL.center.x;
  if (sim.coreR?.center) sim.coreR.center.x = W - sim.coreR.center.x;
  // Weapon mount positions
  const fixW = (w: any): void => {
    if (!w) return;
    if (w.cannon?.pos) w.cannon.pos.x = W - w.cannon.pos.x;
    if (w.laser?.pos) w.laser.pos.x = W - w.laser.pos.x;
    if (w.missile?.pos) w.missile.pos.x = W - w.missile.pos.x;
    if (w.mortar?.pos) w.mortar.pos.x = W - w.mortar.pos.x;
  };
  fixW(sim.wepL);
  fixW(sim.wepR);
  // Bin model positions (and their bodies)
  const fixBins = (bins: any): void => {
    if (!bins) return;
    for (const b of Object.values(bins as Record<string, any>)) {
      if (!b) continue;
      if (b.pos) b.pos.x = W - b.pos.x;
      const by = (b.box?.position?.y ?? 0);
      const iy = (b.intake?.position?.y ?? 0);
      if (b.box) Body.setPosition(b.box, { x: W - (b.box.position?.x ?? 0), y: by });
      if (b.intake) Body.setPosition(b.intake, { x: W - (b.intake.position?.x ?? 0), y: iy });
    }
  };
  fixBins(sim.binsL);
  fixBins(sim.binsR);
}
