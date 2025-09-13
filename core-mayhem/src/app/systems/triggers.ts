import { COOLDOWN_MS, WEAPON_WINDUP_MS, MODS } from '../../config';
import { SHIELD } from '../../config';
import { repair } from '../../core/repair';
import { queueFireCannon, queueFireLaser, queueFireMissiles, queueFireMortar } from '../../sim/weapons';
import { sim } from '../../state';
import { SIDE, type Side } from '../../types';
import { applyBuff, applyDebuff, currentCooldownMul } from '../mods';
import { applyRandomBuff } from '../mods';
import { recordBinCap } from '../stats';
import { audio } from '../../audio';
import { setBanter } from '../../render/banter';
import type { BanterEvent } from '../../banter';

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function runTriggers(now = performance.now()): void {
  const doSide = (side: Side, bins: any, wep: any): void => {
    if (!bins || !wep) return;
    const key = side === SIDE.LEFT ? 'L' : 'R';
    const color = side === SIDE.LEFT ? css('--left') : css('--right');

    if (bins.buff && bins.buff.fill >= bins.buff.cap) {
      bins.buff.fill = 0;
      // Preserve prior behavior by default; allow random pool via config
      if (((MODS as any).buffChooser ?? 'damageOnly') === 'randomPool') applyRandomBuff(side);
      else applyBuff(side);
      try { audio.play('activate_buff'); } catch { /* ignore */ void 0; }
    }
    if (bins.debuff && bins.debuff.fill >= bins.debuff.cap) {
      bins.debuff.fill = 0;
      applyDebuff(side === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT);
      try { audio.play('activate_debuff'); } catch { /* ignore */ void 0; }
    }

    if (bins.cannon.fill >= bins.cannon.cap && now >= sim.cooldowns[key].cannon) {
      try { recordBinCap(side, 'cannon', now); } catch { /* ignore */ void 0; }
      bins.cannon.fill = 0;
      sim.cooldowns[key].cannon = now + Math.round(COOLDOWN_MS.cannon * currentCooldownMul(side));
      (sim.fxArm ||= []).push({ x: wep.cannon.pos.x, y: wep.cannon.pos.y, until: now + WEAPON_WINDUP_MS, color });
      const tc = side === SIDE.LEFT ? (sim as any).coreR : (sim as any).coreL;
      queueFireCannon(side, wep.cannon.pos, tc.center);
      // Banter: shooter taunts lightly on fire
      try { speakBanter('taunt', side); } catch { /* ignore */ }
    }

    if (bins.laser.fill >= bins.laser.cap && now >= sim.cooldowns[key].laser) {
      try { recordBinCap(side, 'laser', now); } catch { /* ignore */ void 0; }
      bins.laser.fill = 0;
      sim.cooldowns[key].laser = now + Math.round(COOLDOWN_MS.laser * currentCooldownMul(side));
      (sim.fxArm ||= []).push({ x: wep.laser.pos.x, y: wep.laser.pos.y, until: now + WEAPON_WINDUP_MS, color });
      const tc = side === SIDE.LEFT ? (sim as any).coreR : (sim as any).coreL;
      queueFireLaser(side, wep.laser.pos, tc);
      try { speakBanter('taunt', side); } catch { /* ignore */ }
    }

    if (bins.missile.fill >= bins.missile.cap && now >= sim.cooldowns[key].missile) {
      try { recordBinCap(side, 'missile', now); } catch { /* ignore */ void 0; }
      bins.missile.fill = 0;
      sim.cooldowns[key].missile = now + Math.round(COOLDOWN_MS.missile * currentCooldownMul(side));
      (sim.fxArm ||= []).push({ x: wep.missile.pos.x, y: wep.missile.pos.y, until: now + WEAPON_WINDUP_MS, color });
      queueFireMissiles(side, wep.missile.pos);
      try { speakBanter('taunt', side); } catch { /* ignore */ }
    }

    if (bins.mortar.fill >= bins.mortar.cap && now >= sim.cooldowns[key].mortar) {
      try { recordBinCap(side, 'mortar', now); } catch { /* ignore */ void 0; }
      bins.mortar.fill = 0;
      sim.cooldowns[key].mortar = now + Math.round(COOLDOWN_MS.mortar * currentCooldownMul(side));
      (sim.fxArm ||= []).push({ x: wep.mortar.pos.x, y: wep.mortar.pos.y, until: now + WEAPON_WINDUP_MS, color });
      queueFireMortar(side, wep.mortar.pos);
      try { speakBanter('taunt', side); } catch { /* ignore */ }
    }

    if (bins.repair.fill >= bins.repair.cap) {
      try { recordBinCap(side, 'repair', now); } catch { /* ignore */ void 0; }
      bins.repair.fill = 0;
      repair(side);
      try { audio.play('armor_increase'); } catch { /* ignore */ void 0; }
    }

    if (bins.shield.fill >= bins.shield.cap) {
      try { recordBinCap(side, 'shield', now); } catch { /* ignore */ void 0; }
      bins.shield.fill = 0;
      const core = side === SIDE.LEFT ? (sim as any).coreL : (sim as any).coreR;
      core.shieldHP = Math.min(core.shieldHPmax, core.shieldHP + SHIELD.onPickup);
      try { audio.play('core_shield_up'); } catch { /* ignore */ void 0; }
    }
  };

  // Determine processing order (diagnostic):
  //  - LR (default): Left then Right
  //  - RL: Right then Left
  //  - alternateTick: flip order every tick
  //  - alternateMatch: flip order every match
  const stg = (sim as any).settings ?? {};
  const mode = (stg.altOrderMode ?? 'LR') as 'LR' | 'RL' | 'alternateTick' | 'alternateMatch';
  const tick = (sim as any).tick | 0;
  const matchIndex = (sim as any).matchIndex | 0;
  let first: Side = SIDE.LEFT;
  if (mode === 'RL') first = SIDE.RIGHT;
  else if (mode === 'alternateTick') first = tick % 2 === 0 ? SIDE.LEFT : SIDE.RIGHT;
  else if (mode === 'alternateMatch') first = matchIndex % 2 === 1 ? SIDE.LEFT : SIDE.RIGHT;
  if (first === SIDE.LEFT) {
    doSide(SIDE.LEFT, (sim as any).binsL, (sim as any).wepL);
    doSide(SIDE.RIGHT, (sim as any).binsR, (sim as any).wepR);
  } else {
    doSide(SIDE.RIGHT, (sim as any).binsR, (sim as any).wepR);
    doSide(SIDE.LEFT, (sim as any).binsL, (sim as any).wepL);
  }
}

function speakBanter(ev: BanterEvent, side: Side): void {
  const b: any = (sim as any).banter;
  const L: any = (sim as any).banterL;
  const R: any = (sim as any).banterR;
  if (!b || !L || !R) return;
  if ((sim as any).banterEnabled === false) return;
  const me = side === SIDE.LEFT ? L : R;
  const them = side === SIDE.LEFT ? R : L;
  const out = b.speak(ev as any, me, them);
  if (out) setBanter(side === SIDE.LEFT ? 'L' : 'R', out.text);
}
