import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { drawFrame } from '../render/draw';
import { drawBanter } from '../render/drawBanter';
import { renderScene } from '../render/renderScene';
import { beginThemeFrame, cssVar, endThemeFrame, resolveFontVars } from '../render/theme';
import { sim } from '../state';

import type { Scene } from '../render/drawModel';

function ctxStub(): CanvasRenderingContext2D {
  const NOOP: (...args: unknown[]) => void = () => {};
  return new Proxy(
    {
      measureText: (text: string) => ({ width: String(text).length * 8 }),
      getTransform: () => ({ a: 1, d: 1 }),
    } as any,
    {
      get: (t, p) => (p in t ? (t as any)[p] : NOOP),
    },
  ) as unknown as CanvasRenderingContext2D;
}

describe('renderScene (smoke)', () => {
  beforeEach(() => {
    document.documentElement.style.setProperty('--left', '#5cf');
    document.documentElement.style.setProperty('--right', '#f76');
  });
  it('renders basic commands without throwing', () => {
    const scene: Scene = {
      width: 640,
      height: 360,
      commands: [
        { kind: 'circle', x: 10, y: 20, r: 5, fill: 'var(--left)' },
        { kind: 'circle', x: 30, y: 40, r: 6, stroke: 'var(--right)', lineWidth: 2 },
        { kind: 'line', x1: 0, y1: 0, x2: 10, y2: 10 },
        { kind: 'text', x: 5, y: 5, text: 'hi' },
      ],
    };
    renderScene(ctxStub(), scene);
    expect(true).toBe(true);
  });

  it('snapshots the theme once for many themed primitives', () => {
    const spy = vi.spyOn(globalThis, 'getComputedStyle');
    const scene: Scene = {
      width: 640,
      height: 360,
      commands: [
        { kind: 'circle', x: 10, y: 20, r: 5, fill: 'var(--left)', stroke: 'var(--right)' },
        { kind: 'circle', x: 30, y: 40, r: 6, stroke: 'var(--left)', fill: '#fff' },
        {
          kind: 'text',
          x: 5,
          y: 5,
          text: 'hi',
          font: '16px var(--mono, monospace)',
        } as Scene['commands'][number],
        {
          kind: 'line',
          x1: 0,
          y1: 0,
          x2: 10,
          y2: 10,
          stroke: 'var(--right)',
        } as Scene['commands'][number],
      ],
    };
    renderScene(ctxStub(), scene);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('theme frame', () => {
  afterEach(() => {
    endThemeFrame();
    endThemeFrame();
    vi.restoreAllMocks();
  });

  it('reuses one snapshot inside a frame and reads again on the next frame', () => {
    document.documentElement.style.setProperty('--left', 'rgb(1, 2, 3)');
    document.documentElement.style.setProperty('--mono', 'CustomMono');
    const spy = vi.spyOn(globalThis, 'getComputedStyle');

    beginThemeFrame();
    expect(cssVar('#fff')).toBe('#fff');
    const first = cssVar('var(--left)');
    expect(cssVar('var(--missing-theme)')).toBe('#000');
    expect(resolveFontVars('')).toBe('');
    expect(resolveFontVars('12px monospace')).toBe('12px monospace');
    expect(resolveFontVars('12px var(--mono, monospace)')).toBe('12px CustomMono');
    expect(resolveFontVars('12px var(--missing-font, serif)')).toBe('12px serif');
    expect(resolveFontVars('12px var(--missing-font)')).toBe('12px monospace');
    expect(resolveFontVars('12px var(--missing-font,   )')).toBe('12px monospace');
    beginThemeFrame();
    expect(cssVar('var(--left)')).toBe(first);
    endThemeFrame();
    endThemeFrame();
    expect(spy).toHaveBeenCalledTimes(1);

    endThemeFrame();
    document.documentElement.style.setProperty('--left', 'rgb(4, 5, 6)');
    const next = cssVar('var(--left)');
    expect(cssVar('var(--left)')).not.toBe(first);
    expect(next).not.toBe(first);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('shares the open frame between the scene and speech bubbles', () => {
    (sim as any).W = 800;
    (sim as any).H = 600;
    (sim as any).coreL = { center: { x: 200, y: 300 }, ringR: 40 };
    (sim as any).coreR = { center: { x: 600, y: 300 }, ringR: 40 };
    (sim as any).banterUI = {
      L: { text: 'Hello', t0: 0, until: 10_000 },
      R: { text: 'There', t0: 0, until: 10_000 },
    };
    const spy = vi.spyOn(globalThis, 'getComputedStyle');
    beginThemeFrame();
    renderScene(ctxStub(), {
      width: 800,
      height: 600,
      commands: [
        { kind: 'circle', x: 1, y: 2, r: 3, fill: 'var(--left)' },
        { kind: 'circle', x: 4, y: 5, r: 3, stroke: 'var(--right)' },
      ],
    });
    drawBanter(ctxStub());
    endThemeFrame();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('snapshots the theme once for a full frame', () => {
    sim.W = 640 as any;
    sim.H = 360 as any;
    sim.coreL = { center: { x: 100, y: 200 }, ringR: 22 } as any;
    sim.coreR = { center: { x: 540, y: 200 }, ringR: 22 } as any;
    (sim as any).banterUI = {
      L: { text: 'Hello', t0: 0, until: 10_000 },
      R: { text: 'There', t0: 0, until: 10_000 },
    };
    const spy = vi.spyOn(globalThis, 'getComputedStyle');
    drawFrame(ctxStub());
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
