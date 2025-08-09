import { Events, World, Body, Query, Composite } from 'matter-js';
import { DEFAULTS } from '../config';
import { COOLDOWN_MS, WEAPON_WINDUP_MS } from '../config';
import { sim } from '../state';
import { Side } from '../types';
import { initWorld, clearWorld } from '../sim/world';
import { makePins } from '../sim/pins';
import { makeBins, nudgeBinsFromPipes  } from '../sim/containers';
import { makeCore, angleToSeg } from '../sim/core';
import { spawnAmmo, beforeUpdateAmmo } from '../sim/ammo';
import { makePipe, applyPipeForces, addPaddle, tickPaddles, gelRect } from '../sim/obstacles';
import { buildLanes } from '../sim/channels';
import { makeWeapons, queueFireCannon, queueFireLaser, queueFireMissiles, queueFireMortar } from '../sim/weapons';
import { tickHoming } from '../sim/weapons';
import { applyGelForces } from '../sim/gel';
import { drawFrame } from '../render/draw';
import { updateHUD } from '../render/hud';
import { FX_MS } from '../config';
import { SHIELD_DECAY_PER_SEC } from '../config';
import { EXPLOSION } from '../config';
import { SHOTS_PER_FILL, SHIELD_EFFECT, REPAIR_EFFECT } from '../config';
import { GAMEOVER } from '../config';
import { fireCannon, fireLaser, fireMissiles, fireMortar } from '../sim/weapons';
// --- DEV HOTKEYS: only in Vite dev or if forced via config ---
import { DEV_KEYS } from '../config';
import { applyCoreDamage } from '../sim/damage';
import { ARMOR } from '../config';
import { MATCH_LIMIT } from '../config';
import { currentDmgMul } from '../sim/mods'; // NEW
import { MODS } from '../config';

const devKeysOn = (import.meta.env?.DEV === true) || DEV_KEYS.enabledInProd;

console.log('cooldowns', COOLDOWN_MS);

const nowMs = () => performance.now();
const sideKey = (s: Side) => (s === Side.LEFT ? 'L' : 'R');

let _explosionCount = 0, _explosionWindowT0 = 0;

export type WeaponKind = 'cannon'|'laser'|'missile'|'mortar';

type SideMods = {
  dmgUntil: number;
  dmgMul: number;
  disableUntil: number;
  disabledType: WeaponKind | null;
};

function ensureMods() {
  const anySim = sim as any;
  if (!anySim.modsL) anySim.modsL = { dmgUntil:0, dmgMul:1, disableUntil:0, disabledType:null } as SideMods;
  if (!anySim.modsR) anySim.modsR = { dmgUntil:0, dmgMul:1, disableUntil:0, disabledType:null } as SideMods;
}

function modsFor(side: Side): SideMods {
  ensureMods();
  return (side === Side.LEFT ? (sim as any).modsL : (sim as any).modsR) as SideMods;
}
function modsForOpposite(side: Side): SideMods {
  return modsFor(side === Side.LEFT ? Side.RIGHT : Side.LEFT);
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

export function applyDebuff(targetSide: Side, kind?: WeaponKind) {
  const m = modsFor(targetSide);
  const pool = MODS.allowedDebuffs;
  const k = kind ?? pool[Math.floor(Math.random() * pool.length)];
  m.disabledType = k;
  m.disableUntil = performance.now() + MODS.debuffDurationMs;
}

function explodeAt(x: number, y: number, baseDmg: number, shooterSide: Side) {
  if (!EXPLOSION.enabled) return;

  // rate limit
  const now = performance.now();
  if (now - _explosionWindowT0 > 1000) { _explosionWindowT0 = now; _explosionCount = 0; }
  if (_explosionCount++ > EXPLOSION.maxPerSec) return;

  // FX (burst)
  const color = shooterSide === Side.LEFT ? css('--left') : css('--right');
  (sim.fxImp ||= []).push({ x, y, t0: now, ms: 350, color, kind: 'burst' });

  // query nearby & push
  const r = EXPLOSION.radius;
  const aabb = { min: { x: x - r, y: y - r }, max: { x: x + r, y: y + r } };
  const bodies = Query.region(Composite.allBodies(sim.world), aabb);

  for (const b of bodies) {
    const plug = (b as any).plugin || {};
    // Push ammo & projectiles away
    if (plug.kind === 'ammo' || plug.kind === 'projectile') {
      const dx = b.position.x - x, dy = b.position.y - y;
      const dist = Math.max(6, Math.hypot(dx, dy));
      const k = EXPLOSION.force / dist;
      Body.applyForce(b, b.position, { x: dx * k * b.mass, y: dy * k * b.mass });

      // Optional: destroy ammo with probability
      if (plug.kind === 'ammo' && Math.random() < EXPLOSION.ammoDestroyPct) {
        World.remove(sim.world, b);
        if (plug.side === Side.LEFT) sim.ammoL = Math.max(0, sim.ammoL - 1);
        else if (plug.side === Side.RIGHT) sim.ammoR = Math.max(0, sim.ammoR - 1);
      }
    }
  }
}

export function startGame(canvas: HTMLCanvasElement) {
  clearWorld();
  initWorld(canvas);
  (sim as any).cooldowns = {
    L: { cannon: 0, laser: 0, missile: 0, mortar: 0 },
    R: { cannon: 0, laser: 0, missile: 0, mortar: 0 },
  };
  (sim as any).fxArm = [];      // wind-up ring FX store
  (sim as any).fxBeam = [];     // laser beams store
  (sim as any).fxImp  = [];     // impact/burn FX store
  (sim as any).fxSweep = [];    // missile sweep pointer FX store
  (sim as any).homing = [];     // missiles to home

  // Persistent global modifiers – initialize ONCE per match here
  (sim as any).mods = {
    dmgUntil: 0, dmgMul: 1,
    disableUntil: 0, disabledType: null as null | 'cannon'|'laser'|'missile'|'mortar',
  };

  // Only seed settings once; keep whatever was already configured between runs
  if (!sim.settings) sim.settings = { ...DEFAULTS };

  sim.started = true;
  (sim as any).stats = (sim as any).stats || { leftWins: 0, rightWins: 0, ties: 0 };
  updateScoreboard(); // draw initial 0–0
  
  if ((sim as any).restartTO) { clearTimeout((sim as any).restartTO); (sim as any).restartTO = 0; }
  (sim as any).gameOver = false;
  (sim as any).winner = null;
  (sim as any).winnerAt = 0;
  (sim as any).matchStart = performance.now();  // ⬅️ stamp match start

  // Edge pipes
  const pipeL = makePipe(Side.LEFT);
  const pipeR = makePipe(Side.RIGHT);
  sim.pipes = [pipeL, pipeR];

  // Layout
  const pinsL = makePins(Side.LEFT,  { anchor: pipeL.innerX });
  const pinsR = makePins(Side.RIGHT, { anchor: pipeR.innerX });
  sim.binsL = makeBins(Side.LEFT, pinsL.mid, pinsL.width);
  sim.binsR = makeBins(Side.RIGHT, pinsR.mid, pinsR.width);
  // push bins away from pipe inner wall by 5px
  nudgeBinsFromPipes(Side.LEFT,  sim.binsL, 5);
  nudgeBinsFromPipes(Side.RIGHT, sim.binsR, 5);

  gelRect(pinsL.mid, sim.H*0.14, pinsL.width*0.96, Math.max(36, sim.H*0.06), { dampX: 2.2, dampY: 3.2 });
  gelRect(pinsR.mid, sim.H*0.14, pinsR.width*0.96, Math.max(36, sim.H*0.06), { dampX: 2.2, dampY: 3.2 });
 
  sim.coreL = makeCore(Side.LEFT, css('--left'));
  sim.coreR = makeCore(Side.RIGHT, css('--right'));

  // Top gel + splitter + funnels
  buildLanes(pinsL.mid, pinsL.width);
  buildLanes(pinsR.mid, pinsR.width);

  // Shaker bars
  addPaddle(pinsL.mid - pinsL.width * 0.20, sim.H * 0.60, 28, 1.2, +1);
  addPaddle(pinsL.mid + pinsL.width * 0.20, sim.H * 0.60, 28, 1.2, -1);
  addPaddle(pinsR.mid - pinsR.width * 0.20, sim.H * 0.60, 28, 1.2, +1);
  addPaddle(pinsR.mid + pinsR.width * 0.20, sim.H * 0.60, 28, 1.2, -1);

  // Weapons (positions are computed; firing happens on bin fill)
  const wepL = makeWeapons(Side.LEFT);
  const wepR = makeWeapons(Side.RIGHT);
  (sim as any).wepL = wepL;
  (sim as any).wepR = wepR;


  if (devKeysOn) {
    const onKey = (e: KeyboardEvent) => {
      if ((sim as any).gameOver) return;

      // helpers
      const L = Side.LEFT, R = Side.RIGHT;
      const cL = sim.coreL.center, cR = sim.coreR.center;

      switch (e.key) {
        // Left side (lowercase)
        case 'c': fireCannon(L,  (wepL as any).cannon.pos,  cR, /*speedOrDmg?*/ 16); break;
        case 'l': fireLaser (L,  (wepL as any).laser.pos,   sim.coreR);            break;
        case 'm': fireMissiles(L, (wepL as any).missile.pos, 5 /*count*/);         break;
        case 'o': fireMortar(L,   (wepL as any).mortar.pos,  3 /*count*/);         break;

        // Right side (uppercase)
        case 'C': fireCannon(R,  (wepR as any).cannon.pos,  cL, 16);               break;
        case 'L': fireLaser (R,  (wepR as any).laser.pos,   sim.coreL);            break;
        case 'M': fireMissiles(R, (wepR as any).missile.pos, 5);                    break;
        case 'O': fireMortar(R,   (wepR as any).mortar.pos,  3);                    break;

        // (optional) quick defensive triggers while tuning:
        // case 'S': sim.coreL.shield = Math.max(sim.coreL.shield, 2.5); break;
        // case 'R': repair(Side.LEFT); break;
        // case 'X': sim.coreR.shield = Math.max(sim.coreR.shield, 2.5); break;
        // case 'T': repair(Side.RIGHT); break;
      }
    };

    window.addEventListener('keydown', onKey);
    // Remove on stop so we don't stack listeners across restarts
    (sim as any)._devKeyHandler = onKey;
  }


  // Collisions: deposits + core hits
Events.on(sim.engine, 'collisionStart', (e) => {
  for (const p of e.pairs) {
    const A = p.bodyA as any, B = p.bodyB as any;
    const a = A.plugin || {}, b = B.plugin || {};

    // deposits (unchanged)
    if (a.kind === 'ammo' && b.kind === 'container') { deposit(A, B); continue; }
    if (b.kind === 'ammo' && a.kind === 'container') { deposit(B, A); continue; }

    // direct core hits (apply damage + FX; we also explode below inside hit())
    if (a.kind === 'projectile' && (b.kind === 'coreRing' || b.kind === 'coreCenter')) { hit(A, B); continue; }
    if (b.kind === 'projectile' && (a.kind === 'coreRing' || a.kind === 'coreCenter')) { hit(B, A); continue; }

    // explode-on-anything (except mounts) with grace period
    const explodeIf = (proj: any, other: any) => {
      const pp = proj?.plugin || {};
      if (pp.kind !== 'projectile') return;
      if (other?.plugin?.kind === 'weaponMount') return; // ignore mounts
      if (performance.now() - (pp.spawnT || 0) < EXPLOSION.graceMs) return; // grace

      explodeAt(proj.position.x, proj.position.y, pp.dmg || 8, pp.side);
      World.remove(sim.world, proj);
    };

    // pop if projectile touches anything (ammo, pins, walls, containers, beamSensor, etc.)
    explodeIf(A, B);
    explodeIf(B, A);
  }
});

  function deposit(ammo: any, container: any) {
    const accept = container.plugin.accept as string[];
    if (!accept.includes(ammo.plugin.type)) return;
    World.remove(sim.world, ammo);
    (ammo.plugin.side === Side.LEFT ? sim.ammoL-- : sim.ammoR--);
    const bins = (container.plugin.side === Side.LEFT ? sim.binsL : sim.binsR) as any;
    const key = container.plugin.label as string;
    if (bins[key]) bins[key].fill++;
  }

  function hit(proj: any, coreBody: any) {
    const side: Side = coreBody.plugin.side;
    const core = side === Side.LEFT ? sim.coreL : sim.coreR;
    const dmg = ((proj.plugin.dmg || 8) * (core.shield > 0 ? 0.35 : 1)) * currentDmgMul();

    // Center sensor hit → direct center damage
    if (coreBody.plugin.kind === 'coreCenter') {
      core.centerHP = Math.max(0, core.centerHP - dmg);
    } else {
      // Rim sensor hit → segments, with spillover to center as configured
      applyCoreDamage(core, proj.position, dmg, angleToSeg);
    }
    
    // spawn a small FX at impact ---
    const ptype = proj?.plugin?.ptype || 'cannon';
    const shooterSide = proj?.plugin?.side;
    const color = shooterSide === Side.LEFT ? css('--left') : css('--right');
    (sim.fxImp ||= []).push({
      x: proj.position.x, y: proj.position.y,
      t0: performance.now(),
      ms: ptype === 'laser' ? FX_MS.burn : FX_MS.impact,
      color,
      kind: ptype === 'laser' ? 'burn' : 'burst'
    });
    explodeAt(proj.position.x, proj.position.y, proj.plugin.dmg || 8, proj.plugin.side);
    World.remove(sim.world, proj);
    maybeEndMatch(); // <-- add this
  }

  // Game update
  Events.on(sim.engine, 'beforeUpdate', () => {
    const dtMs = (sim.engine.timing.lastDelta || 16.6);
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

    // Global modifiers live across the match, reset on start
    (sim as any).mods = {
      dmgUntil: 0, dmgMul: 1,
      disableUntil: 0, disabledType: null as null | string,
    };

    beforeUpdateAmmo();
    applyGelForces();  
    applyPipeForces(sim.pipes);
    tickPaddles(dt);
    tickHoming(dtMs);

    sim.coreL.shield = Math.max(0, (sim.coreL.shield || 0) - dt * SHIELD_DECAY_PER_SEC);
    sim.coreR.shield = Math.max(0, (sim.coreR.shield || 0) - dt * SHIELD_DECAY_PER_SEC);

    // soft target spawn
    sim.spawnAcc += dtMs;
    const per = 1000 / sim.settings.spawnRate;
    const softMin = sim.settings.targetAmmo * 0.75, softMax = sim.settings.targetAmmo * 1.25;
    while (sim.spawnAcc > per) {
      sim.spawnAcc -= per;
      if (sim.ammoL < softMax) { if (sim.ammoL < softMin) { spawnAmmo(Side.LEFT); spawnAmmo(Side.LEFT); } else spawnAmmo(Side.LEFT); }
      if (sim.ammoR < softMax) { if (sim.ammoR < softMin) { spawnAmmo(Side.RIGHT); spawnAmmo(Side.RIGHT); } else spawnAmmo(Side.RIGHT); }
    }

    // bin triggers
    const doSide = (side: Side, bins: any, wep: any) => {
      const key = side === Side.LEFT ? 'L' : 'R';
      const color = side === Side.LEFT ? css('--left') : css('--right');
      const now = performance.now();

      // --- inside doSide(side, bins, wep) ---
      if (bins.buff && bins.buff.fill >= bins.buff.cap) {
        bins.buff.fill = 0;
        applyBuff(side); // buff your own side
      }
      if (bins.debuff && bins.debuff.fill >= bins.debuff.cap) {
        bins.debuff.fill = 0;
        applyDebuff(side === Side.LEFT ? Side.RIGHT : Side.LEFT); // debuff the other side
      }

      if (bins.cannon.fill >= bins.cannon.cap && now >= sim.cooldowns[key].cannon) {
        bins.cannon.fill = 0;
        sim.cooldowns[key].cannon = now + COOLDOWN_MS.cannon;
        sim.fxArm.push({ x: wep.cannon.pos.x, y: wep.cannon.pos.y, until: now + WEAPON_WINDUP_MS, color });
        queueFireCannon(side, wep.cannon.pos, (side === Side.LEFT ? sim.coreR.center : sim.coreL.center));
      }

      if (bins.laser.fill >= bins.laser.cap && now >= sim.cooldowns[key].laser) {
        bins.laser.fill = 0;
        sim.cooldowns[key].laser = now + COOLDOWN_MS.laser;
        sim.fxArm.push({ x: wep.laser.pos.x, y: wep.laser.pos.y, until: now + WEAPON_WINDUP_MS, color });
        queueFireLaser(side, wep.laser.pos, (side === Side.LEFT ? sim.coreR : sim.coreL));
      }

      if (bins.missile.fill >= bins.missile.cap && now >= sim.cooldowns[key].missile) {
        bins.missile.fill = 0;
        sim.cooldowns[key].missile = now + COOLDOWN_MS.missile;
        sim.fxArm.push({ x: wep.missile.pos.x, y: wep.missile.pos.y, until: now + WEAPON_WINDUP_MS, color });
        queueFireMissiles(side, wep.missile.pos);
      }

      if (bins.mortar.fill >= bins.mortar.cap && now >= sim.cooldowns[key].mortar) {
        bins.mortar.fill = 0;
        sim.cooldowns[key].mortar = now + COOLDOWN_MS.mortar;
        sim.fxArm.push({ x: wep.mortar.pos.x, y: wep.mortar.pos.y, until: now + WEAPON_WINDUP_MS, color });
        queueFireMortar(side, wep.mortar.pos);
      }
      
      if (bins.repair.fill >= bins.repair.cap) {
        bins.repair.fill = 0;
        repair(side); // uses REPAIR_EFFECT below
      }

      if (bins.shield.fill >= bins.shield.cap) {
        bins.shield.fill = 0;
        const core = (side === Side.LEFT ? sim.coreL : sim.coreR);
        core.shield = Math.max(core.shield, SHIELD_EFFECT.gain);
      }
    };
    doSide(Side.LEFT, sim.binsL, wepL);
    doSide(Side.RIGHT, sim.binsR, wepR);

    sim.coreL.rot += sim.coreL.rotSpeed;
    sim.coreR.rot += sim.coreR.rotSpeed;
    
    // did someone die this frame?
    maybeEndMatch();
  });

  // Render loop
  const ctx = canvas.getContext('2d')!;
  let raf = 0, frames = 0, fpsTimer = performance.now();
  const loop = () => {
    drawFrame(ctx);
    updateHUD();
    const now = performance.now(); frames++;
    if (now - fpsTimer > 500) { 
      const fpsVal = Math.round(frames * 1000 / (now - fpsTimer));
      (document.getElementById('fps')!).textContent = String(fpsVal);
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
  const core = side === Side.LEFT ? sim.coreL : sim.coreR;

  // heal N weakest segments
  for (let k = 0; k < REPAIR_EFFECT.segmentsToHeal; k++) {
    let idx = 0, min = 1e9;
    for (let i = 0; i < core.segHP.length; i++) {
      const hp = core.segHP[i];
      if (hp < min) { min = hp; idx = i; }
    }
    core.segHP[idx] = Math.min(core.segHPmax, core.segHP[idx] + REPAIR_EFFECT.segHealAmount);
  }

  // occasional center repair
  if (Math.random() < REPAIR_EFFECT.centerChance) {
    core.centerHP = Math.min(core.centerHPmax, core.centerHP + REPAIR_EFFECT.centerAmount);
  }
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function isDead(core: any) {
  return (core?.centerHP | 0) <= 0;
}

function declareWinner(winner: Side | 0) {
  (sim as any).winner = winner;   // 0 = tie
  (sim as any).gameOver = true;
  (sim as any).winnerAt = performance.now();
  
  const stats = (sim as any).stats || ((sim as any).stats = { leftWins:0, rightWins:0, ties:0 });
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
  declareWinner(deadL && deadR ? 0 : (deadL ? Side.RIGHT : Side.LEFT));
}

function updateScoreboard() {
  const el = document.getElementById('score');
  if (!el) return;
  const s = (sim as any).stats || { leftWins:0, rightWins:0, ties:0 };
  const lWins = s.leftWins|0, rWins = s.rightWins|0, ties = s.ties|0;

  // losses are the opponent's wins
  const lLoss = rWins, rLoss = lWins;

  // Build inner HTML to keep colored tags
  el.innerHTML = `
    <span class="left tag">LEFT</span> ${lWins}–${lLoss}
    ${ties ? `<span class="sep">|</span> T:${ties} <span class="sep">|</span>` : `<span class="sep">|</span>`}
    <span class="right tag">RIGHT</span> ${rWins}–${rLoss}
  `;
}


function isWeaponDisabled(kind: string): boolean {
  const m = (sim as any).mods;
  if (nowMs() > m.disableUntil) { m.disabledType = null; }
  return m.disabledType === kind;
}

// activators
// function activateBuff() {
//   const m = (sim as any).mods || ((sim as any).mods = {});
//   const dur = Math.max(5000, Number(GLOBAL_MODS?.buffMs || 30000)); // fallback 30s, min 5s
//   const until = Math.max(m.dmgUntil || 0, nowMs() + dur);
//   m.dmgMul = Number(GLOBAL_MODS?.dmgMultiplier || 2.0);
//   m.dmgUntil = until;
// }

// function activateDebuff() {
//   const m = (sim as any).mods || ((sim as any).mods = {});
//   const pool = (GLOBAL_MODS?.debuffable as readonly string[]) || ['cannon','laser','missile','mortar','artillery'];
//   const dur  = Math.max(5000, Number(GLOBAL_MODS?.debuffMs || 30000)); // fallback 30s, min 5s
//   const pick = pool[Math.floor(Math.random()*pool.length)];
//   m.disabledType = pick;
//   m.disableUntil = Math.max(m.disableUntil || 0, nowMs() + dur);
// }