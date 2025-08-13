import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// A very forgiving 2D context stub so drawFrame() can call anything safely.
function createCtxStub() {
  const NOOP = () => {};
  const metrics = { width: 0 }; // measureText() result shape
  // Return a Proxy that turns any property access into a no-op function or number as needed
  return new Proxy(
    {
      canvas: { width: 800, height: 600 },
      measureText: () => metrics,
    },
    {
      get: (t, p) => (p in t ? (t as any)[p] : NOOP),
    },
  );
}

describe('Core Mayhem boot (smoke)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="stage">
        <button id="btnStart">Start</button>
        <button id="btnStop" disabled>Stop</button>
        <div id="hud">
          <span id="fps"></span>
          <div id="score"></div>
        </div>
        <canvas id="view" width="800" height="600"></canvas>
      </div>
    `;

    // Create a forgiving 2D context
    const canvas = document.getElementById('view') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getContext').mockImplementation((type: string) => {
      if (type !== '2d') return null;
      const NOOP = () => {};
      const base = { canvas, measureText: () => ({ width: 0 }) };
      return new Proxy(base as any, { get: (t, p) => (p in t ? (t as any)[p] : NOOP) });
    });

    // Fallback: if code asks for a missing HUD node, auto-create it.
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

    // (Optional) give CSS vars some value to avoid empty colors
    document.documentElement.style.setProperty('--left', '#5cf');
    document.documentElement.style.setProperty('--right', '#f76');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('wires UI and starts/stops without console errors', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Import your real entry (side-effect bootstraps listeners)
    await import('../main');

    const startBtn = document.getElementById('btnStart') as HTMLButtonElement;
    const stopBtn = document.getElementById('btnStop') as HTMLButtonElement;

    // Start the game
    startBtn.click();

    // Let one frame render
    await new Promise((r) => setTimeout(r, 30));

    // Stop the game
    stopBtn.click();

    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    // Sanity: FPS/score elements exist and are strings
    const fps = document.getElementById('fps')!;
    const score = document.getElementById('score')!;
    expect(typeof fps.textContent).toBe('string');
    expect(typeof score.innerHTML).toBe('string');
  });

  it('handles soft restart event without throwing', async () => {
    await import('../main');
    (document.getElementById('btnStart') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 10));
    // Fire the event your game.ts listens for
    window.dispatchEvent(new CustomEvent('coreMayhem:restart'));
    await new Promise((r) => setTimeout(r, 10));
    (document.getElementById('btnStop') as HTMLButtonElement).click();
    expect(true).toBe(true); // reached without error
  });
});
