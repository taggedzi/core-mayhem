import { DEV_KEYS } from '../config';
import { fireCannon, fireLaser, fireMissiles, fireMortar } from '../sim/weapons';
import type { WeaponsType } from '../sim/weapons';
import { sim } from '../state';
import { SIDE } from '../types';

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
    }
  };

  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
