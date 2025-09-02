import { DEFAULTS } from '../../config';
import { spawnAmmo } from '../../sim/ammo';
import { sim } from '../../state';
import { SIDE } from '../../types';

export function runSpawn(dtMs: number): void {
  sim.spawnAcc += dtMs;
  const stg = (sim as any).settings ?? DEFAULTS;
  const per = 1000 / stg.spawnRate;
  const softMin = stg.targetAmmo * 0.75;
  const softMax = stg.targetAmmo * 1.25;
  while (sim.spawnAcc > per) {
    sim.spawnAcc -= per;
    if (sim.ammoL < softMax) {
      if (sim.ammoL < softMin) {
        spawnAmmo(SIDE.LEFT);
        spawnAmmo(SIDE.LEFT);
      } else spawnAmmo(SIDE.LEFT);
    }
    if (sim.ammoR < softMax) {
      if (sim.ammoR < softMin) {
        spawnAmmo(SIDE.RIGHT);
        spawnAmmo(SIDE.RIGHT);
      } else spawnAmmo(SIDE.RIGHT);
    }
  }
}

