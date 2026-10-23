import { audio } from '../../audio';
import { COOLDOWN_MS, WEAPON_WINDUP_MS, MODS } from '../../config';
import { SHIELD } from '../../config';
import { repair } from '../../core/repair';
import { simNowMs } from '../../sim/clock';
import {
  queueFireCannon,
  queueFireLaser,
  queueFireMissiles,
  queueFireMortar,
  type WeaponsType,
} from '../../sim/weapons';
import { sim } from '../../state';
import { SIDE, type Bins, type Side, type WeaponKind } from '../../types';
import { applyBuff, applyDebuff, currentCooldownMul } from '../mods';
import { applyRandomBuff } from '../mods';
import { speakBanterSmart } from '../speakBanterLLM';
import { recordBinCap } from '../stats';

// setBanter handled via speakBanterSmart
import type { BanterEvent } from '../../banter';

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function releaseWeapon(
  side: Side,
  bins: Bins,
  wep: WeaponsType,
  now: number,
  color: string,
  id: WeaponKind,
  fire: (pos: { x: number; y: number }) => void,
): void {
  const bin = bins[id];
  const mount = wep[id];
  if (!bin || !mount) return;
  const key = side === SIDE.LEFT ? 'L' : 'R';
  if (bin.fill < bin.cap || now < sim.cooldowns[key][id]) return;
  try {
    recordBinCap(side, id, now);
  } catch {
    /* ignore */ void 0;
  }
  bin.fill = 0;
  sim.cooldowns[key][id] = now + Math.round(COOLDOWN_MS[id] * currentCooldownMul(side));
  (sim.fxArm ||= []).push({
    x: mount.pos.x,
    y: mount.pos.y,
    until: now + WEAPON_WINDUP_MS,
    color,
  });
  fire(mount.pos);
  try {
    speakBanter('taunt', side);
  } catch {
    /* ignore */
  }
}

export function runTriggers(now = simNowMs()): void {
  const doSide = (side: Side, bins: Bins | null, wep: WeaponsType | null): void => {
    if (!bins || !wep) return;
    const color = side === SIDE.LEFT ? css('--left') : css('--right');

    if (bins.buff && bins.buff.fill >= bins.buff.cap) {
      bins.buff.fill = 0;
      try {
        recordBinCap(side, 'buff', now);
      } catch {
        /* Statistics must not block the trigger. */
      }
      // Preserve prior behavior by default; allow random pool via config
      if (((MODS as any).buffChooser ?? 'damageOnly') === 'randomPool') applyRandomBuff(side);
      else applyBuff(side);
      try {
        audio.play('activate_buff');
      } catch {
        /* ignore */ void 0;
      }
    }
    if (bins.debuff && bins.debuff.fill >= bins.debuff.cap) {
      bins.debuff.fill = 0;
      try {
        recordBinCap(side, 'debuff', now);
      } catch {
        /* Statistics must not block the trigger. */
      }
      const victim = side === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT;
      applyDebuff(victim);
      try {
        audio.play('activate_debuff');
      } catch {
        /* ignore */ void 0;
      }
      // Banter: debuff victim reacts
      try {
        speakBanter('debuffed' as any, victim);
      } catch {
        /* ignore */
      }
    }

    const foe = side === SIDE.LEFT ? (sim as any).coreR : (sim as any).coreL;
    releaseWeapon(side, bins, wep, now, color, 'cannon', (pos) => {
      queueFireCannon(side, pos, foe.center);
    });
    releaseWeapon(side, bins, wep, now, color, 'laser', (pos) => {
      queueFireLaser(side, pos, foe);
    });
    releaseWeapon(side, bins, wep, now, color, 'missile', (pos) => {
      queueFireMissiles(side, pos);
    });
    releaseWeapon(side, bins, wep, now, color, 'mortar', (pos) => {
      queueFireMortar(side, pos);
    });

    if (bins.repair && bins.repair.fill >= bins.repair.cap) {
      try {
        recordBinCap(side, 'repair', now);
      } catch {
        /* ignore */ void 0;
      }
      bins.repair.fill = 0;
      repair(side);
      try {
        audio.play('armor_increase');
      } catch {
        /* ignore */ void 0;
      }
      // Banter: self-repair acknowledgment
      try {
        speakBanter('repair' as any, side);
      } catch {
        /* ignore */
      }
    }

    if (bins.shield && bins.shield.fill >= bins.shield.cap) {
      try {
        recordBinCap(side, 'shield', now);
      } catch {
        /* ignore */ void 0;
      }
      bins.shield.fill = 0;
      const core = side === SIDE.LEFT ? (sim as any).coreL : (sim as any).coreR;
      core.shieldHP = Math.min(core.shieldHPmax, core.shieldHP + SHIELD.onPickup);
      try {
        audio.play('core_shield_up');
      } catch {
        /* ignore */ void 0;
      }
      // Banter: shields up acknowledgment
      try {
        speakBanter('shields_up' as any, side);
      } catch {
        /* ignore */
      }
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
    doSide(SIDE.LEFT, sim.binsL, sim.wepL);
    doSide(SIDE.RIGHT, sim.binsR, sim.wepR);
  } else {
    doSide(SIDE.RIGHT, sim.binsR, sim.wepR);
    doSide(SIDE.LEFT, sim.binsL, sim.wepL);
  }
}

function speakBanter(ev: BanterEvent, side: Side): void {
  void speakBanterSmart(ev, side === SIDE.LEFT ? 'L' : 'R');
}
