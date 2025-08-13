import { describe, it, expect, beforeEach } from 'vitest';

import { renderScene } from '../render/renderScene';

import type { Scene } from '../render/drawModel';

function ctxStub(): CanvasRenderingContext2D {
  const NOOP: (...args: unknown[]) => void = () => {};
  return new Proxy({ measureText: () => ({ width: 0 }) } as any, {
    get: (t, p) => (p in t ? (t as any)[p] : NOOP),
  }) as unknown as CanvasRenderingContext2D;
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
});
