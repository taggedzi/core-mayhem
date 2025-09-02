import { beforeUpdateAmmo } from '../../sim/ammo';
import { applyGelForces } from '../../sim/gel';
import { applyPipeForces, tickPaddles } from '../../sim/obstacles';
import { tickHoming } from '../../sim/weapons';
import { sim } from '../../state';

export function runPhysics(dtMs: number): void {
  const dt = dtMs / 1000;
  beforeUpdateAmmo();
  applyGelForces();
  applyPipeForces(sim.pipes);
  tickPaddles(dt);
  tickHoming(dtMs);

  // Advance core rotation
  const cL = sim.coreL as any;
  if (cL && typeof cL.rot === 'number' && typeof cL.rotSpeed === 'number') cL.rot += cL.rotSpeed;
  const cR = sim.coreR as any;
  if (cR && typeof cR.rot === 'number' && typeof cR.rotSpeed === 'number') cR.rot += cR.rotSpeed;
}

