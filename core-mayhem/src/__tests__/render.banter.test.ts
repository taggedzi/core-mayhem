import { describe, it, expect, beforeEach, vi } from 'vitest';

import { setBanter, clearBanter, setBanterEnabled } from '../render/banter';
import { sim } from '../state';

describe('render/banter helpers', () => {
  beforeEach(() => {
    // Reset sim state and DOM
    (sim as any).banterUI = undefined;
    (sim as any).banterEnabled = true;
    document.body.innerHTML = '<div id="banterL">X</div><div id="banterR">Y</div>';
    vi.spyOn(performance, 'now').mockReturnValue(1000);
  });

  it('setBanter populates sim.banterUI with time window for left side', () => {
    setBanter('L', 'Hello', 600);
    const ui: any = (sim as any).banterUI;
    expect(ui).toBeTruthy();
    expect(ui.L.text).toBe('Hello');
    expect(ui.L.t0).toBe(1000);
    expect(ui.L.until).toBe(1600);
    // right side remains untouched
    expect(ui.R.text).toBe('');
  });

  it('setBanter respects disabled flag (no update)', () => {
    (sim as any).banterEnabled = false;
    setBanter('R', 'Nope', 600);
    expect((sim as any).banterUI).toBeUndefined();
  });

  it('clearBanter clears DOM overlay text and sim state per side and both', () => {
    // seed sim ui
    (sim as any).banterUI = { L: { text: 'L', t0: 1, until: 2 }, R: { text: 'R', t0: 3, until: 4 } };
    // set visible text
    const elL = document.getElementById('banterL')!;
    const elR = document.getElementById('banterR')!;
    elL.textContent = 'HelloL';
    elR.textContent = 'HelloR';

    clearBanter('L');
    expect(elL.textContent).toBe('');
    expect((sim as any).banterUI.L.text).toBe('');
    // right side remains
    expect(elR.textContent).toBe('HelloR');
    expect((sim as any).banterUI.R.text).toBe('R');

    clearBanter(); // both
    expect(elR.textContent).toBe('');
    expect((sim as any).banterUI.R.text).toBe('');
  });

  it('setBanterEnabled(false) flips flag and clears banter', () => {
    (sim as any).banterUI = { L: { text: 'L', t0: 1, until: 2 }, R: { text: 'R', t0: 3, until: 4 } };
    const elL = document.getElementById('banterL')!;
    elL.textContent = 'T';
    setBanterEnabled(false);
    expect((sim as any).banterEnabled).toBe(false);
    expect(elL.textContent).toBe('');
    expect((sim as any).banterUI.L.text).toBe('');
    expect((sim as any).banterUI.R.text).toBe('');
  });
});

