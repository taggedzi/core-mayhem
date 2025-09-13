// Minimal DOM helper to display banter lines per side, with auto-clear
import { sim } from '../state';

let toL: number | null = null;
let toR: number | null = null;

export function setBanter(side: 'L' | 'R', text: string, ms = 6000): void {
  if ((sim as any).banterEnabled === false) return;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // Also record into sim so canvas can draw speech bubbles near cores
  try {
    const ui = ((sim as any).banterUI ||= { L: { text: '', t0: 0, until: 0 }, R: { text: '', t0: 0, until: 0 } });
    const until = now + Math.max(500, ms | 0);
    if (side === 'L') { ui.L.text = text; ui.L.t0 = now; ui.L.until = until; }
    else { ui.R.text = text; ui.R.t0 = now; ui.R.until = until; }
  } catch { /* ignore */ }

  // Optional DOM overlay (debug). Disabled by default now that we draw bubbles on canvas.
  const USE_DOM_OVERLAY = false;
  if (USE_DOM_OVERLAY) {
    const id = side === 'L' ? 'banterL' : 'banterR';
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (el) {
      el.textContent = text;
      const prev = side === 'L' ? toL : toR;
      if (prev !== null) window.clearTimeout(prev);
      const to = window.setTimeout(() => {
        if (el.textContent === text) el.textContent = '';
        if (side === 'L') toL = null; else toR = null;
      }, Math.max(500, ms | 0));
      if (side === 'L') toL = to; else toR = to;
    }
  }
}

export function clearBanter(side?: 'L' | 'R'): void {
  const doSide = (s: 'L' | 'R') => {
    const id = s === 'L' ? 'banterL' : 'banterR';
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (!el) return;
    el.textContent = '';
    const prev = s === 'L' ? toL : toR;
    if (prev !== null) window.clearTimeout(prev);
    if (s === 'L') toL = null; else toR = null;
    try {
      const ui = (sim as any).banterUI;
      if (ui) {
        if (s === 'L') { ui.L.text = ''; ui.L.t0 = 0; ui.L.until = 0; }
        else { ui.R.text = ''; ui.R.t0 = 0; ui.R.until = 0; }
      }
    } catch { /* ignore */ }
  };
  if (!side) { doSide('L'); doSide('R'); }
  else doSide(side);
}

export function setBanterEnabled(on: boolean): void {
  (sim as any).banterEnabled = !!on;
  if (!on) {
    try { clearBanter(); } catch { /* ignore */ }
  }
}
