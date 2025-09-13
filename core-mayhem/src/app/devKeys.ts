import { DEV_KEYS, DEFAULTS } from '../config';
import { MESMER } from '../config';
import { fireCannon, fireLaser, fireMissiles, fireMortar } from '../sim/weapons';
import { sim } from '../state';
import { SIDE } from '../types';

import { runTriggers } from './systems/triggers';

import type { WeaponsType } from '../sim/weapons';


const devKeysOn = import.meta.env?.DEV === true || DEV_KEYS.enabledInProd;

// Export a concise help list for UI overlay
export const DEV_HELP_LINES: readonly string[] = [
  'c/l/m/o: Left fire Cannon/Laser/Missile/Mortar',
  'C/L/M/O: Right fire Cannon/Laser/Missile/Mortar',
  '[ / ]: Slow down / speed up time',
  '- / +: Decrease / increase target ammo',
  ', / .: Decrease / increase pipe speed',
  '; / P: Decrease / increase pipe gain',
  'b / B: Fill Buff Bin (Left / Right)',
  'd / D: Fill Debuff Bin (Left / Right)',
  'V: Cycle mesmer visuals Off → Low → Always',
  'N: Toggle banter on/off',
];

export function attachDevHotkeys(wepL: WeaponsType, wepR: WeaponsType): () => void {
  if (!devKeysOn) return () => undefined;

  let toastTO = 0;
  const toast = (msg: string, ms = 1500): void => {
    const el = document.getElementById('state');
    if (!el) { console.warn(msg); return; }
    const prev = el.textContent ?? '';
    el.textContent = msg;
    console.warn(msg);
    if (toastTO) clearTimeout(toastTO);
    toastTO = window.setTimeout(() => { el.textContent = prev || 'Idle'; }, ms);
  };

  const onKey = (e: KeyboardEvent): void => {
    if (sim.gameOver) return;

    const L = SIDE.LEFT,
      R = SIDE.RIGHT;
    const cLCore = sim.coreL;
    const cRCore = sim.coreR;
    if (!cLCore || !cRCore) return;
    const cL = cLCore.center,
      cR = cRCore.center;

    switch (e.key) {
      // Left side (lowercase)
      case 'c':
        fireCannon(L, wepL.cannon.pos, cR, 16);
        break;
      case 'l':
        fireLaser(L, wepL.laser.pos, cRCore);
        break;
      case 'm':
        fireMissiles(L, wepL.missile.pos, 5);
        break;
      case 'o':
        fireMortar(L, wepL.mortar.pos, 3);
        break;

      // Right side (uppercase)
      case 'C':
        fireCannon(R, wepR.cannon.pos, cL, 16);
        break;
      case 'L':
        fireLaser(R, wepR.laser.pos, cLCore);
        break;
      case 'M':
        fireMissiles(R, wepR.missile.pos, 5);
        break;
      case 'O':
        fireMortar(R, wepR.mortar.pos, 3);
        break;

      // Visuals: cycle mesmer mode Off → Low → Always
      case 'v':
      case 'V': {
        const order: ('off' | 'low' | 'always')[] = ['off', 'low', 'always'];
        const cur = (sim as any).mesmerMode ?? (MESMER as any).mode ?? 'always';
        const idx = order.indexOf(cur as any);
        const next = order[(idx + 1) % order.length];
        (sim as any).mesmerMode = next;
        toast(`Mesmer: ${next}`);
        break;
      }

      // Toggle banter visibility quickly
      case 'n':
      case 'N': {
        (sim as any).banterEnabled = !(sim as any).banterEnabled;
        const on = (sim as any).banterEnabled !== false;
        toast(`Banter: ${on ? 'on' : 'off'}`);
        if (!on) {
          try {
            const elL = document.getElementById('banterL');
            const elR = document.getElementById('banterR');
            if (elL) elL.textContent = '';
            if (elR) elR.textContent = '';
          } catch { /* ignore */ }
        }
        break;
      }

      // Global tune: time scale slower/faster
      case '[': {
        const stg = ((sim as any).settings ??= { ...DEFAULTS });
        stg.timescale = Math.max(0.5, Math.min(1.5, (stg.timescale ?? 1) - 0.1));
        toast(`Time x${(stg.timescale ?? 1).toFixed(2)}`);
        break;
      }
      case ']': {
        const stg = ((sim as any).settings ??= { ...DEFAULTS });
        stg.timescale = Math.max(0.5, Math.min(1.5, (stg.timescale ?? 1) + 0.1));
        toast(`Time x${(stg.timescale ?? 1).toFixed(2)}`);
        break;
      }

      // Global tune: on-field ammo target up/down
      case '-': {
        const stg = ((sim as any).settings ??= { ...DEFAULTS });
        stg.targetAmmo = Math.max(20, Math.round((stg.targetAmmo ?? 100) - 10));
        toast(`TargetAmmo ${stg.targetAmmo}`);
        break;
      }
      case '=': // usually + on US keyboards
      case '+': {
        const stg = ((sim as any).settings ??= { ...DEFAULTS });
        stg.targetAmmo = Math.max(20, Math.round((stg.targetAmmo ?? 100) + 10));
        toast(`TargetAmmo ${stg.targetAmmo}`);
        break;
      }

      // Pipe vertical lift speed (slower/faster in the side pipes)
      case ',': {
        const stg = ((sim as any).settings ??= { ...DEFAULTS });
        stg.pipeUpSpeed = Math.max(6, Math.round(((stg.pipeUpSpeed ?? DEFAULTS.pipeUpSpeed ?? 22) - 2)));
        toast(`PipeUpSpeed ${stg.pipeUpSpeed}px/s`);
        break;
      }
      case '.': {
        const stg = ((sim as any).settings ??= { ...DEFAULTS });
        stg.pipeUpSpeed = Math.max(6, Math.round(((stg.pipeUpSpeed ?? DEFAULTS.pipeUpSpeed ?? 22) + 2)));
        toast(`PipeUpSpeed ${stg.pipeUpSpeed}px/s`);
        break;
      }

      // Pipe vertical lift responsiveness (how quickly it reaches target speed)
      case ';': {
        const stg = ((sim as any).settings ??= { ...DEFAULTS });
        stg.pipeUpGain = Math.max(0.4, Number(((stg.pipeUpGain ?? DEFAULTS.pipeUpGain ?? 3.2) - 0.2).toFixed(2)));
        toast(`PipeUpGain ${stg.pipeUpGain.toFixed(2)}/s`);
        break;
      }
      case 'p':
      case 'P': {
        const stg = ((sim as any).settings ??= { ...DEFAULTS });
        stg.pipeUpGain = Math.min(8, Number(((stg.pipeUpGain ?? DEFAULTS.pipeUpGain ?? 3.2) + 0.2).toFixed(2)));
        toast(`PipeUpGain ${stg.pipeUpGain.toFixed(2)}/s`);
        break;
      }

      // Quick banner previews / mod triggers
      // b/B → simulate filling the BUFF bin on left/right
      case 'b':
        try {
          const bins: any = (sim as any).binsL;
          if (bins?.buff) {
            bins.buff.fill = bins.buff.cap;
            runTriggers();
          }
        } catch { /* ignore */ void 0; }
        break;
      case 'B':
        try {
          const bins: any = (sim as any).binsR;
          if (bins?.buff) {
            bins.buff.fill = bins.buff.cap;
            runTriggers();
          }
        } catch { /* ignore */ void 0; }
        break;
      // d/D → simulate filling the DEBUFF bin on left/right
      case 'd':
        try {
          const bins: any = (sim as any).binsL;
          if (bins?.debuff) {
            bins.debuff.fill = bins.debuff.cap;
            runTriggers();
          }
        } catch { /* ignore */ void 0; }
        break;
      case 'D':
        try {
          const bins: any = (sim as any).binsR;
          if (bins?.debuff) {
            bins.debuff.fill = bins.debuff.cap;
            runTriggers();
          }
        } catch { /* ignore */ void 0; }
        break;
      // 'h' is handled globally by the help overlay (src/ui/help.ts)
    }
  };

  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
