import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { attachDevHotkeys, setDevModeEnabled } from '../app/devKeys';
import { bootWithCanvas } from '../boot';
import { sim } from '../state';
import { initHelpOverlay } from '../ui/help';
import { initIntroOverlay } from '../ui/intro';
import { activateModal, allowGameShortcut } from '../ui/keyboard';

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

describe('keyboard and modal scope', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('ignores editable, composition and modifier targets while allowing game keys', () => {
    document.body.innerHTML =
      '<input id="url"><textarea></textarea><select></select><div contenteditable="true"><span>edit</span></div><canvas tabindex="0"></canvas>';
    const results: boolean[] = [];
    const listener = (event: KeyboardEvent): void => {
      results.push(allowGameShortcut(event));
    };
    document.addEventListener('keydown', listener);
    for (const element of document.querySelectorAll('input, textarea, select, span'))
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
    for (const options of [
      { isComposing: true },
      { ctrlKey: true },
      { altKey: true },
      { metaKey: true },
      {},
    ])
      document
        .querySelector('canvas')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true, ...options }));
    document.removeEventListener('keydown', listener);
    expect(results).toEqual([false, false, false, false, false, false, false, false, true]);
  });

  it('keeps Tab in the modal, blocks background shortcuts, and restores focus/inert state', () => {
    document.body.innerHTML =
      '<button id="opener">Open</button><div id="root"><div id="panel" tabindex="-1"><button id="first">First</button><button id="last">Last</button></div></div>';
    const opener = document.getElementById('opener')!;
    opener.focus();
    const root = document.getElementById('root')!;
    const panel = document.getElementById('panel')!;
    const close = vi.fn();
    const release = activateModal(root, panel, close);
    expect(opener.inert).toBe(true);
    expect(allowGameShortcut(new KeyboardEvent('keydown', { key: 'c' }))).toBe(false);
    const first = document.getElementById('first')!;
    const last = document.getElementById('last')!;
    last.focus();
    last.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(first);
    first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(last);
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(close).toHaveBeenCalledOnce();
    release();
    expect(opener.inert).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('typing a URL never opens Help or changes simulation speed; game shortcuts still work', () => {
    document.body.innerHTML =
      '<input id="url"><canvas tabindex="0"></canvas><span id="state"></span>';
    vi.stubGlobal('__BUILD_DATE__', '2026-10-23');
    initHelpOverlay();
    setDevModeEnabled(true);
    sim.gameOver = false;
    sim.settings.timescale = 1;
    sim.coreL = { center: { x: 0, y: 0 } } as any;
    sim.coreR = { center: { x: 100, y: 0 } } as any;
    const detach = attachDevHotkeys({} as any, {} as any);
    const input = document.getElementById('url')!;
    input.focus();
    for (const key of 'http://localhost]')
      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    expect(document.getElementById('helpOverlay')!.style.display).toBe('none');
    expect(sim.settings.timescale).toBe(1);
    document
      .querySelector('canvas')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: ']', bubbles: true }));
    expect(sim.settings.timescale).toBeCloseTo(1.1);
    document
      .querySelector('canvas')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true, cancelable: true }));
    expect(document.getElementById('helpOverlay')!.style.display).toBe('block');
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    detach();
  });

  it('scopes intro activation to its panel and intended Start control', () => {
    document.body.innerHTML = '<input id="background">';
    const start = vi.fn();
    initIntroOverlay(start);
    document
      .getElementById('background')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(start).not.toHaveBeenCalled();
    const button = document.querySelector<HTMLButtonElement>('.intro-start-btn')!;
    button.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    );
    expect(start).not.toHaveBeenCalled();
    button.click();
    expect(start).toHaveBeenCalledOnce();
    expect(document.getElementById('background')!.inert).toBe(false);
  });
});
