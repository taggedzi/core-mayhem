import { DEV_KEYS, DEFAULTS } from '../config';
import { applyBuff, applyDebuff, pushBanner } from './mods';
import { fireCannon, fireLaser, fireMissiles, fireMortar } from '../sim/weapons';
import type { WeaponsType } from '../sim/weapons';
import { sim } from '../state';
import { SIDE } from '../types';
import { MESMER } from '../config';

const devKeysOn = import.meta.env?.DEV === true || DEV_KEYS.enabledInProd;

export function attachDevHotkeys(wepL: WeaponsType, wepR: WeaponsType): () => void {
  if (!devKeysOn) return () => {};

  let toastTO = 0;
  const toast = (msg: string, ms = 1500): void => {
    const el = document.getElementById('state');
    if (!el) { console.log(msg); return; }
    const prev = el.textContent ?? '';
    el.textContent = msg;
    console.log(msg);
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
        const order: Array<'off' | 'low' | 'always'> = ['off', 'low', 'always'];
        const cur = (sim as any).mesmerMode ?? (MESMER as any).mode ?? 'always';
        const idx = order.indexOf(cur as any);
        const next = order[(idx + 1) % order.length];
        (sim as any).mesmerMode = next;
        toast(`Mesmer: ${next}`);
        break;
      }

      // Global tune: time scale slower/faster
      case '[': {
        const stg = ((sim as any).settings ||= { ...DEFAULTS });
        stg.timescale = Math.max(0.5, Math.min(1.5, (stg.timescale ?? 1) - 0.1));
        toast(`Time x${(stg.timescale ?? 1).toFixed(2)}`);
        break;
      }
      case ']': {
        const stg = ((sim as any).settings ||= { ...DEFAULTS });
        stg.timescale = Math.max(0.5, Math.min(1.5, (stg.timescale ?? 1) + 0.1));
        toast(`Time x${(stg.timescale ?? 1).toFixed(2)}`);
        break;
      }

      // Global tune: on-field ammo target up/down
      case '-': {
        const stg = ((sim as any).settings ||= { ...DEFAULTS });
        stg.targetAmmo = Math.max(20, Math.round((stg.targetAmmo ?? 100) - 10));
        toast(`TargetAmmo ${stg.targetAmmo}`);
        break;
      }
      case '=': // usually + on US keyboards
      case '+': {
        const stg = ((sim as any).settings ||= { ...DEFAULTS });
        stg.targetAmmo = Math.max(20, Math.round((stg.targetAmmo ?? 100) + 10));
        toast(`TargetAmmo ${stg.targetAmmo}`);
        break;
      }

      // Pipe vertical lift speed (slower/faster in the side pipes)
      case ',': {
        const stg = ((sim as any).settings ||= { ...DEFAULTS });
        stg.pipeUpSpeed = Math.max(6, Math.round(((stg.pipeUpSpeed ?? DEFAULTS.pipeUpSpeed ?? 22) - 2)));
        toast(`PipeUpSpeed ${stg.pipeUpSpeed}px/s`);
        break;
      }
      case '.': {
        const stg = ((sim as any).settings ||= { ...DEFAULTS });
        stg.pipeUpSpeed = Math.max(6, Math.round(((stg.pipeUpSpeed ?? DEFAULTS.pipeUpSpeed ?? 22) + 2)));
        toast(`PipeUpSpeed ${stg.pipeUpSpeed}px/s`);
        break;
      }

      // Pipe vertical lift responsiveness (how quickly it reaches target speed)
      case ';': {
        const stg = ((sim as any).settings ||= { ...DEFAULTS });
        stg.pipeUpGain = Math.max(0.4, Number(((stg.pipeUpGain ?? DEFAULTS.pipeUpGain ?? 3.2) - 0.2).toFixed(2)));
        toast(`PipeUpGain ${stg.pipeUpGain.toFixed(2)}/s`);
        break;
      }
      case 'p':
      case 'P': {
        const stg = ((sim as any).settings ||= { ...DEFAULTS });
        stg.pipeUpGain = Math.min(8, Number(((stg.pipeUpGain ?? DEFAULTS.pipeUpGain ?? 3.2) + 0.2).toFixed(2)));
        toast(`PipeUpGain ${stg.pipeUpGain.toFixed(2)}/s`);
        break;
      }

      // Quick banner previews / mod triggers
      // b/B → apply BUFF on left/right (shows banner + applies effect)
      case 'b':
        applyBuff(L);
        break;
      case 'B':
        applyBuff(R);
        break;
      // d/D → apply random DEBUFF on left/right
      case 'd':
        applyDebuff(L);
        break;
      case 'D':
        applyDebuff(R);
        break;
      // h/H → show a help banner describing controls (non-mod, preview only)
      case 'h':
      case 'H': {
        pushBanner(L, 'HELP', {
          sub: 'Dev Controls',
          lines: [
            '[ / ]: Time scale',
            '- / =: Target ammo',
            ', / .: Pipe speed',
            '; / P: Pipe gain',
            'b/B: Buff L/R  d/D: Debuff L/R',
            'V: Mesmer Off/Low/Always',
          ],
          ms: 4200,
        });
        break;
      }
    }
  };

  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
