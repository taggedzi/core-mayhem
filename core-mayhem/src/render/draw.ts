import { sim } from '../state';

import { toDrawCommands } from './drawModel';
import { renderScene } from './renderScene';

export function drawFrame(ctx: CanvasRenderingContext2D): void {
  const W = sim.W, H = sim.H;
  ctx.clearRect(0, 0, W, H);
  const scene = toDrawCommands(performance.now());
  renderScene(ctx, scene);
}
