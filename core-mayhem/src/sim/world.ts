import { Engine, Runner, World, Bodies, Composite } from 'matter-js';
import { sim } from '../state';

function fit16x9(canvas: HTMLCanvasElement){
  const stage = canvas.parentElement as HTMLElement;
  const availW = stage.clientWidth;
  const availH = stage.clientHeight;
  const target = 16/9;
  let w = Math.floor(availW);
  let h = Math.floor(w / target);
  if (h > availH) { h = Math.floor(availH); w = Math.floor(h * target); }
  // Set CSS size so clientWidth/Height report the 16:9 box
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  return { w, h };
}

export function initWorld(canvas: HTMLCanvasElement){
  // 1) pick a 16:9 rect that fits Stage and size the canvas element to it
  const { w: cssW, h: cssH } = fit16x9(canvas);
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio||1));
  // 2) set backing store to CSS size * DPR
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  const ctx = canvas.getContext('2d')!; ctx.setTransform(dpr,0,0,dpr,0,0);

  sim.W = cssW; sim.H = cssH; sim.dpr = dpr;
  sim.engine = Engine.create({ enableSleeping:false });
  sim.world = sim.engine.world;

  // (optional stability; small perf cost)
  sim.engine.positionIterations = 8;
  sim.engine.velocityIterations = 6;
  
  sim.runner = Runner.create();
  Runner.run(sim.runner, sim.engine);

  // soft gravity — we’ll throw projectiles manually
  sim.engine.gravity.y = 0.9;

  // world bounds (use the 16:9 W/H)
  World.add(sim.world,[
    Bodies.rectangle(sim.W/2,sim.H+40,sim.W,80,{isStatic:true}),
    Bodies.rectangle(-40,sim.H/2,80,sim.H,{isStatic:true}),
    Bodies.rectangle(sim.W+40,sim.H/2,80,sim.H,{isStatic:true}),
    Bodies.rectangle(sim.W/2,-40,sim.W,80,{isStatic:true}),
  ]);
}

export function clearWorld(){
  if (sim.runner) Runner.stop(sim.runner);
  if (sim.engine) {
    World.clear(sim.engine.world, false);
    Engine.clear(sim.engine);
  }
  // guard against undefined
  (sim.gels     ||= []).length = 0;
  (sim.paddles  ||= []).length = 0;
  (sim.flippers ||= []).length = 0;
  (sim.rotors   ||= []).length = 0;
  (sim.pipes    ||= []).length = 0;
  (sim.hoppers  ||= []).length = 0;

  sim.ammoL = 0; sim.ammoR = 0; sim.spawnAcc = 0;
}