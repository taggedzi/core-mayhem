import { Composite, type World as MatterWorld } from 'matter-js';
import { sim } from '../state';
import { toDrawCommands } from './drawModel';
import { renderScene } from './renderScene';

const SHOW_DAMPERS = true; // set false later to hide them entirely
const css = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function assertWorld(w: MatterWorld | null): asserts w is MatterWorld {
  if (!w) throw new Error('World not initialized');
}

export function drawFrame(ctx: CanvasRenderingContext2D): void {
  const W = sim.W, H = sim.H;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  {
    const now = performance.now();
    const t0 = (sim as any).shakeT0 ?? 0;
    const ms = (sim as any).shakeMs ?? 0;
    const amp = (sim as any).shakeAmp ?? 0;
    const age = now - t0;
    if (age >= 0 && age < ms && amp > 0) {
      const k = 1 - age / ms;
      const a = now * 0.08;
      ctx.translate(Math.sin(a * 1.7) * amp * k, Math.cos(a * 1.3) * amp * k);
    }
  }
  const world = sim.world; // capture to allow narrowing
  assertWorld(world);

  // Dampers (faint outline only)
  if (SHOW_DAMPERS) {
    for (const g of sim.gels) {
      const b = g.bounds;
      ctx.save();
      ctx.setLineDash([2, 10]); // thin dash
      ctx.lineWidth = 0.6; // thinner line
      ctx.strokeStyle = 'rgba(0,255,213,0.12)'; // low opacity
      ctx.strokeRect(b.min.x, b.min.y, b.max.x - b.min.x, b.max.y - b.min.y);
      ctx.restore();
    }
  }

  // Build and paint scene
  const scene = toDrawCommands(performance.now());
  renderScene(ctx, scene);
  ctx.restore();
}

