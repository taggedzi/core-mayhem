// near other arrays
import { Engine, Runner, World } from 'matter-js';
import type { Settings, Core, Bins } from './types';
import type { Pipe } from './sim/obstacles';
import type { Hopper } from './sim/hopper';

export const sim = {
  engine: null as unknown as Engine,
  runner: null as unknown as Runner,
  world: null as unknown as World,
  W: 0, H: 0, dpr: 1,
  started: false,
  settings: null as unknown as Settings,
  coreL: null as unknown as Core,
  coreR: null as unknown as Core,
  binsL: null as unknown as Bins,
  binsR: null as unknown as Bins,
  wepL: null as any,
  wepR: null as any,
  gels: [] as Matter.Body[],
  rotors: [] as Matter.Body[],
  paddles: [] as Matter.Body[],
  flippers: [] as Matter.Body[],
  hoppers: [] as Hopper[],
  pipes: [] as Pipe[],
  fxSweep: [] as { x:number; y:number; t0:number; ms:number; a0:number; a1:number; side:-1|1 }[],
  // transient visual FX
  fxArm: [] as { x:number; y:number; until:number; color:string }[],
  fxImp: [] as { x:number; y:number; t0:number; ms:number; color:string; kind:'burst'|'burn' }[],
  fxBeam: [] as { x0:number; y0:number; x1:number; y1:number; t0:number; ms:number; side:-1|1 }[],
  homing: [] as Matter.Body[], // missiles to steer each frame
  ammoL: 0, ammoR: 0,
  spawnAcc: 0,
  cooldowns: { L: { cannon:0, laser:0, missile:0, mortar:0 },
               R: { cannon:0, laser:0, missile:0, mortar:0 } },
};