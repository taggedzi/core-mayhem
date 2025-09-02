import { describe, it, expect, beforeEach } from 'vitest';

import { toDrawCommands } from '../render/drawModel';
import { sim, resetSimState } from '../state';

describe('toDrawCommands: FX and Game Over banner', () => {
  beforeEach(() => {
    resetSimState();
    sim.W = 640 as any;
    sim.H = 360 as any;
    const eng = (globalThis as any).__dmEng || ( (globalThis as any).__dmEng = require('matter-js').Engine.create());
    sim.world = eng.world;
    // CSS variables used by renderer
    document.documentElement.style.setProperty('--left', '#5cf');
    document.documentElement.style.setProperty('--right', '#f76');
  });

  it('renders impact FX as circles', () => {
    (sim as any).fxImp.push({ x: 12, y: 34, t0: performance.now() - 50, ms: 350, color: '#fff', kind: 'burst' });
    const scene = toDrawCommands();
    const hasCircle = scene.commands.some((c) => c.kind === 'circle');
    expect(hasCircle).toBe(true);
  });

  it('renders Game Over banner with rect and text', () => {
    (sim as any).gameOver = true;
    (sim as any).winner = 0;
    (sim as any).winnerAt = performance.now() - 1000;
    const scene = toDrawCommands();
    const hasRect = scene.commands.some((c) => c.kind === 'rect');
    const hasText = scene.commands.some((c) => c.kind === 'text');
    expect(hasRect).toBe(true);
    expect(hasText).toBe(true);
  });
});
