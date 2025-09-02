import { DEV_KEYS } from '../config';
import { fireCannon, fireLaser, fireMissiles, fireMortar } from '../sim/weapons';
import type { WeaponsType } from '../sim/weapons';
import { sim } from '../state';
import { SIDE } from '../types';
import { MESMER } from '../config';

const devKeysOn = import.meta.env?.DEV === true || DEV_KEYS.enabledInProd;

export function attachDevHotkeys(wepL: WeaponsType, wepR: WeaponsType): () => void {
  if (!devKeysOn) return () => {};

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
        const el = document.getElementById('state');
        if (el) el.textContent = `Mesmer: ${next}`;
        break;
      }
    }
  };

  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
