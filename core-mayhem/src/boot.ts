import { startGame } from './app/game';

export function bootWithCanvas(canvas: HTMLCanvasElement): { stop: () => void } {
  const stopFn = startGame(canvas);
  return { stop: stopFn };
}
