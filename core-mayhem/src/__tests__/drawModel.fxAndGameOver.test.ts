import { describe, it, expect, beforeEach } from 'vitest';

import { toDrawCommands } from '../render/drawModel';
import { sim, resetSimState } from '../state';

describe('toDrawCommands: FX and Game Over banner', () => {
  beforeEach(() => {
    resetSimState();
    sim.W = 640 as any;
    sim.H = 360 as any;
    const eng =
      (globalThis as any).__dmEng ??
      ((globalThis as any).__dmEng = require('matter-js').Engine.create());
    sim.world = eng.world;
    // CSS variables used by renderer
    document.documentElement.style.setProperty('--left', '#5cf');
    document.documentElement.style.setProperty('--right', '#f76');
  });

  it('draws each live effect once and skips expired effects', () => {
    const now = 10_000;
    (sim as any).fxBeam = [
      { x0: 1, y0: 2, x1: 3, y1: 4, t0: 9_000, ms: 500, side: -1 },
      { x0: 10, y0: 20, x1: 30, y1: 40, t0: 9_800, ms: 400, side: 1 },
    ];
    (sim as any).fxImp = [
      { x: 5, y: 6, t0: 9_000, ms: 400, color: '#fff', kind: 'burst' },
      { x: 50, y: 60, t0: 9_700, ms: 500, color: '#abc', kind: 'burst', power: 20 },
      { x: 70, y: 80, t0: 9_900, ms: 300, color: '#def', kind: 'burn' },
    ];
    (sim as any).fxBeams = [
      { x1: 100, y1: 110, x2: 120, y2: 130, side: -1, t0: now - 20, tEnd: now + 80 },
      { x1: 200, y1: 210, x2: 220, y2: 230, side: 1, t0: now - 500, tEnd: now - 1 },
    ];

    const scene = toDrawCommands(now);
    const at = (kind: string, x: number): number =>
      scene.commands.filter((c) => c.kind === kind && 'x' in c && c.x === x).length;
    const linesFrom = (x1: number): number =>
      scene.commands.filter((c) => c.kind === 'line' && 'x1' in c && c.x1 === x1).length;

    expect(linesFrom(1)).toBe(0);
    expect(linesFrom(10)).toBe(1);
    expect(at('circle', 5)).toBe(0);
    expect(at('circle', 50)).toBe(1);
    expect(at('circle', 70)).toBe(1);
    expect(linesFrom(100)).toBe(1);
    expect(scene.commands.filter((c) => c.kind === 'path').length).toBe(1);
    expect(linesFrom(200)).toBe(0);
  });

  it('renders Game Over banner with rect and text', () => {
    const now = 10_000;
    (sim as any).gameOver = true;
    (sim as any).winner = 0;
    (sim as any).winnerAt = now - 1000;
    const scene = toDrawCommands(now);
    const hasRect = scene.commands.some((c) => c.kind === 'rect');
    const hasText = scene.commands.some((c) => c.kind === 'text');
    expect(hasRect).toBe(true);
    expect(hasText).toBe(true);
  });
});
