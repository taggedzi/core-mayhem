import { DEFAULTS } from '../../config';
import { spawnAmmo } from '../../sim/ammo';
import { sim } from '../../state';
import { SIDE, type Side } from '../../types';

export function runSpawn(dtMs: number): void {
  sim.spawnAcc += dtMs;
  const stg = (sim as any).settings ?? DEFAULTS;
  const per = 1000 / stg.spawnRate;
  const softMin = stg.targetAmmo * 0.75;
  const softMax = stg.targetAmmo * 1.25;
  while (sim.spawnAcc > per) {
    sim.spawnAcc -= per;
    // Alternate spawn side order based on diagnostic mode (same as triggers)
    const mode = (stg.altOrderMode ?? 'LR') as 'LR' | 'RL' | 'alternateTick' | 'alternateMatch';
    const tick = (sim as any).tick | 0;
    const matchIndex = (sim as any).matchIndex | 0;
    let first: Side = SIDE.LEFT;
    if (mode === 'RL') first = SIDE.RIGHT;
    else if (mode === 'alternateTick') first = tick % 2 === 0 ? SIDE.LEFT : SIDE.RIGHT;
    else if (mode === 'alternateMatch') first = matchIndex % 2 === 1 ? SIDE.LEFT : SIDE.RIGHT;
    const second: Side = first === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT;

    const trySpawn = (side: Side): void => {
      if (side === SIDE.LEFT) {
        if (sim.ammoL < softMax) {
          if (sim.ammoL < softMin) { spawnAmmo(SIDE.LEFT); spawnAmmo(SIDE.LEFT); }
          else spawnAmmo(SIDE.LEFT);
        }
      } else {
        if (sim.ammoR < softMax) {
          if (sim.ammoR < softMin) { spawnAmmo(SIDE.RIGHT); spawnAmmo(SIDE.RIGHT); }
          else spawnAmmo(SIDE.RIGHT);
        }
      }
    };

    trySpawn(first);
    trySpawn(second);
  }
}

