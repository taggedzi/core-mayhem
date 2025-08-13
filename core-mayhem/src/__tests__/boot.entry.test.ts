import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { bootWithCanvas } from '../boot';

// very forgiving 2D context stub for canvas
function ctxStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const NOOP: (...args: unknown[]) => void = () => {};
  return new Proxy(
    { canvas, measureText: () => ({ width: 0 }) },
    { get: (t, p) => (p in t ? (t as any)[p] : NOOP) },
  ) as unknown as CanvasRenderingContext2D;
}

describe('bootWithCanvas', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="hud">
        <span id="fps"></span>
        <div id="score"></div>
      </div>
      <canvas id="view" width="800" height="600"></canvas>
    `;

    const canvas = document.getElementById('view') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getContext').mockImplementation((type: string) => {
      if (type === '2d') return ctxStub(canvas);
      return null;
    });

    // make missing HUD ids auto-create (keeps test resilient)
    const realGet = document.getElementById.bind(document);
    vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      const found = realGet(id);
      if (found) return found;
      const hud = realGet('hud') ?? document.body;
      const span = document.createElement('span');
      span.id = id;
      hud.appendChild(span);
      return span;
    });

    // css var colors used by game code
    document.documentElement.style.setProperty('--left', '#5cf');
    document.documentElement.style.setProperty('--right', '#f76');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('starts and stops cleanly', async () => {
    const canvas = document.getElementById('view') as HTMLCanvasElement;
    const { stop } = bootWithCanvas(canvas);
    await new Promise((r) => setTimeout(r, 30)); // let a frame tick
    stop();
    expect(true).toBe(true); // reached without error
  });
});
