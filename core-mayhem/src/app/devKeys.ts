import { DEV_KEYS } from '../config';
import { fireCannon, fireLaser, fireMissiles, fireMortar } from '../sim/weapons';
import { sim } from '../state';
import { SIDE } from '../types';

const devKeysOn = import.meta.env?.DEV === true || DEV_KEYS.enabledInProd;

export function attachDevHotkeys(wepL: any, wepR: any): () => void {
  if (!devKeysOn) return () => {};

  const onKey = (e: KeyboardEvent): void => {
    if ((sim as any).gameOver) return;

    const L = SIDE.LEFT,
      R = SIDE.RIGHT;
    const cLCore = sim.coreL as any;
    const cRCore = sim.coreR as any;
    if (!cLCore || !cLCore.center || !cRCore || !cRCore.center) return;
    const cL = cLCore.center,
      cR = cRCore.center;

    switch (e.key) {
      // Left side (lowercase)
      case 'c':
        fireCannon(L, (wepL as any).cannon.pos, cR, 16);
        break;
      case 'l':
        fireLaser(L, (wepL as any).laser.pos, cRCore);
        break;
      case 'm':
        fireMissiles(L, (wepL as any).missile.pos, 5);
        break;
      case 'o':
        fireMortar(L, (wepL as any).mortar.pos, 3);
        break;

      // Right side (uppercase)
      case 'C':
        fireCannon(R, (wepR as any).cannon.pos, cL, 16);
        break;
      case 'L':
        fireLaser(R, (wepR as any).laser.pos, cLCore);
        break;
      case 'M':
        fireMissiles(R, (wepR as any).missile.pos, 5);
        break;
      case 'O':
        fireMortar(R, (wepR as any).mortar.pos, 3);
        break;
    }
  };

  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

