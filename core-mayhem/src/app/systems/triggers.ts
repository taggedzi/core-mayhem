import { COOLDOWN_MS, WEAPON_WINDUP_MS } from '../../config';
import { SHIELD } from '../../config';
import { applyBuff, applyDebuff } from '../mods';
import { queueFireCannon, queueFireLaser, queueFireMissiles, queueFireMortar } from '../../sim/weapons';
import { sim } from '../../state';
import { SIDE, type Side } from '../../types';
import { repair } from '../../core/repair';

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
      applyBuff(side);
    }
    if (bins.debuff && bins.debuff.fill >= bins.debuff.cap) {
      bins.debuff.fill = 0;
      applyDebuff(side === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT);
    }

    if (bins.cannon.fill >= bins.cannon.cap && now >= sim.cooldowns[key].cannon) {
      bins.cannon.fill = 0;
      sim.cooldowns[key].cannon = now + COOLDOWN_MS.cannon;
      (sim.fxArm ||= []).push({ x: wep.cannon.pos.x, y: wep.cannon.pos.y, until: now + WEAPON_WINDUP_MS, color });
      const tc = side === SIDE.LEFT ? (sim as any).coreR : (sim as any).coreL;
      queueFireCannon(side, wep.cannon.pos, tc.center);
    }

    if (bins.laser.fill >= bins.laser.cap && now >= sim.cooldowns[key].laser) {
      bins.laser.fill = 0;
      sim.cooldowns[key].laser = now + COOLDOWN_MS.laser;
      (sim.fxArm ||= []).push({ x: wep.laser.pos.x, y: wep.laser.pos.y, until: now + WEAPON_WINDUP_MS, color });
      const tc = side === SIDE.LEFT ? (sim as any).coreR : (sim as any).coreL;
      queueFireLaser(side, wep.laser.pos, tc);
    }

    if (bins.missile.fill >= bins.missile.cap && now >= sim.cooldowns[key].missile) {
      bins.missile.fill = 0;
      sim.cooldowns[key].missile = now + COOLDOWN_MS.missile;
      (sim.fxArm ||= []).push({ x: wep.missile.pos.x, y: wep.missile.pos.y, until: now + WEAPON_WINDUP_MS, color });
      queueFireMissiles(side, wep.missile.pos);
    }

    if (bins.mortar.fill >= bins.mortar.cap && now >= sim.cooldowns[key].mortar) {
      bins.mortar.fill = 0;
      sim.cooldowns[key].mortar = now + COOLDOWN_MS.mortar;
      (sim.fxArm ||= []).push({ x: wep.mortar.pos.x, y: wep.mortar.pos.y, until: now + WEAPON_WINDUP_MS, color });
      queueFireMortar(side, wep.mortar.pos);
    }

    if (bins.repair.fill >= bins.repair.cap) {
      bins.repair.fill = 0;
      repair(side);
    }

    if (bins.shield.fill >= bins.shield.cap) {
      bins.shield.fill = 0;
      const core = side === SIDE.LEFT ? (sim as any).coreL : (sim as any).coreR;
      core.shieldHP = Math.min(core.shieldHPmax, core.shieldHP + SHIELD.onPickup);
    }
  };

  doSide(SIDE.LEFT, (sim as any).binsL, (sim as any).wepL);
  doSide(SIDE.RIGHT, (sim as any).binsR, (sim as any).wepR);
}

