import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  getTransform() { return { a: 1, d: 1 } as any; }
  measureText(s: string) { return { width: s.length * 8 } as any; }
  save = () => { this.logs.push('save'); };
  restore = () => { this.logs.push('restore'); };
  beginPath = () => { this.logs.push('begin'); };
  moveTo = (_x: number, _y: number) => { /* noop */ };
  lineTo = (_x: number, _y: number) => { /* noop */ };
  arcTo = (_x1: number, _y1: number, _x2: number, _y2: number, _r: number) => { /* noop */ };
  closePath = () => { /* noop */ };
  fill = () => { this.logs.push('fill'); };
  stroke = () => { this.logs.push('stroke'); };
  fillText = (s: string, x: number, y: number) => { this.logs.push(`text:${s}:${Math.round(x)},${Math.round(y)}`); };
}

function setupSim() {
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
    const long = 'This is a fairly long banter line that should wrap over multiple lines for readability.';
    (sim as any).banterUI = {
      L: { text: long, t0: 900, until: 2000 },
      R: { text: long, t0: 900, until: 2000 },
    };
    drawBanter(ctx as unknown as CanvasRenderingContext2D);
    const texts = ctx.logs.filter((s) => s.startsWith('text:'));
    // Should draw more than one line total across both sides
    expect(texts.length).toBeGreaterThan(2);
  });
});
