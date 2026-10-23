import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AVATAR } from '../config';
import { drawBanter } from '../render/drawBanter';
import { sim } from '../state';

class MockCtx {
  logs: string[] = [];
  globalCompositeOperation = '';
  globalAlpha = 1;
  lineWidth = 0;
  fillStyle = '';
  strokeStyle = '';
  shadowBlur = 0;
  shadowColor = '';
  textBaseline = '';
  textAlign = '';
  getTransform(): any {
    return { a: 1, d: 1 } as any;
  }
  measureText(s: string): any {
    return { width: s.length * 8 } as any;
  }
  save = (): void => {
    this.logs.push('save');
  };
  restore = (): void => {
    this.logs.push('restore');
  };
  beginPath = (): void => {
    this.logs.push('begin');
  };
  moveTo = (_x: number, _y: number): void => {
    /* noop */
  };
  lineTo = (_x: number, _y: number): void => {
    /* noop */
  };
  arcTo = (_x1: number, _y1: number, _x2: number, _y2: number, _r: number): void => {
    /* noop */
  };
  closePath = (): void => {
    /* noop */
  };
  fill = (): void => {
    this.logs.push('fill');
  };
  stroke = (): void => {
    this.logs.push('stroke');
  };
  fillText = (s: string, x: number, y: number): void => {
    this.logs.push(`text:${s}:${Math.round(x)},${Math.round(y)}`);
  };
}

function setupSim(): void {
  // canvas size and core geometry
  (sim as any).W = 800;
  (sim as any).H = 600;
  (sim as any).coreL = { center: { x: 200, y: 300 }, ringR: 40 };
  (sim as any).coreR = { center: { x: 600, y: 300 }, ringR: 40 };
}

describe('drawBanter', () => {
  beforeEach(() => {
    setupSim();
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    // CSS variables used for stroke accents
    document.documentElement.style.setProperty('--left', '#11aa11');
    document.documentElement.style.setProperty('--right', '#aa1111');
  });

  it('does nothing when no banterUI', () => {
    const ctx = new MockCtx();
    (sim as any).banterUI = null;
    drawBanter(ctx as unknown as CanvasRenderingContext2D);
    expect(ctx.logs.length).toBe(0);
  });

  it('draws with missing avatar settings, transforms, and timestamps', () => {
    const ctx = new MockCtx();
    vi.spyOn(ctx, 'getTransform').mockReturnValue({});
    const cfg = AVATAR as any;
    const original = { ...cfg };
    try {
      delete cfg.orbR;
      delete cfg.left;
      document.documentElement.style.removeProperty('--left');
      document.documentElement.style.removeProperty('--right');
      (sim as any).banterUI = { L: { text: 'Fallback' }, R: null };
      drawBanter(ctx as unknown as CanvasRenderingContext2D);
      expect(ctx.logs.filter((s) => s.startsWith('text:'))).toHaveLength(1);
      expect(ctx.strokeStyle).toBe('#000');
      expect(ctx.globalAlpha).toBe(1);
    } finally {
      Object.assign(cfg, original);
    }
  });

  it('draws whitespace without text lines and accepts a zero-valued label', () => {
    const ctx = new MockCtx();
    (sim as any).banterUI = { L: { text: '   ', until: 2000 }, R: { text: 0, until: 2000 } };
    drawBanter(ctx as unknown as CanvasRenderingContext2D);
    expect(ctx.logs).toContain('fill');
    expect(ctx.logs.filter((s) => s.startsWith('text:'))).toHaveLength(0);
  });

  it('skips expired entries', () => {
    const ctx = new MockCtx();
    (sim as any).banterUI = {
      L: { text: 'old', t0: 0, until: 500 },
      R: { text: '', t0: 0, until: 0 },
    };
    drawBanter(ctx as unknown as CanvasRenderingContext2D);
    expect(ctx.logs.some((s) => s.startsWith('text:'))).toBe(false);
  });

  it('draws a simple one-line bubble for the left side', () => {
    const ctx = new MockCtx();
    (sim as any).banterUI = {
      L: { text: 'Hello', t0: 900, until: 2000 },
      R: { text: '', t0: 0, until: 0 },
    };
    drawBanter(ctx as unknown as CanvasRenderingContext2D);
    const texts = ctx.logs.filter((s) => s.startsWith('text:'));
    expect(texts.length).toBe(1);
    expect(texts[0]).toContain('Hello');
  });

  it('wraps long text into multiple lines and draws both sides', () => {
    const ctx = new MockCtx();
    const long =
      'This is a fairly long banter line that should wrap over multiple lines for readability.';
    (sim as any).banterUI = {
      L: { text: long, t0: 900, until: 2000 },
      R: { text: long, t0: 900, until: 2000 },
    };
    drawBanter(ctx as unknown as CanvasRenderingContext2D);
    const texts = ctx.logs.filter((s) => s.startsWith('text:'));
    // Should draw more than one line total across both sides
    expect(texts.length).toBeGreaterThan(2);
  });
  it('draws no bubbles while banter is disabled', () => {
    const ctx = new MockCtx();
    (sim as any).banterEnabled = false;
    (sim as any).banterUI = { L: { text: 'still pending', t0: 0, until: 2000 } };
    drawBanter(ctx as unknown as CanvasRenderingContext2D);
    expect(ctx.logs).toHaveLength(0);
    (sim as any).banterEnabled = true;
  });
});
