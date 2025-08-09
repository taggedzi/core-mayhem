import { startGame } from './app/game';
import { updateHUD } from './render/hud';

let stopGame: (() => void) | null = null;
let restarting = false;
let resizeTimer: number | null = null;

function start() {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  // stop the previous run (if any)
  if (stopGame) {
    try { stopGame(); } catch { /* ignore */ }
    stopGame = null;
  }
  stopGame = startGame(canvas);

  // toggle buttons
  (document.getElementById('btnStart') as HTMLButtonElement).disabled = true;
  (document.getElementById('btnStop') as HTMLButtonElement).disabled = false;
}

function stop() {
  if (stopGame) {
    try { stopGame(); } catch { /* ignore */ }
  }
  stopGame = null;

  updateHUD();              // ← ensure the label flips even if game.ts changes later
  (document.getElementById('btnStart') as HTMLButtonElement).disabled = false;
  (document.getElementById('btnStop') as HTMLButtonElement).disabled = true;
}

function scheduleRestart() {
  // only restart if we are currently running
  if (!stopGame) return;
  if (restarting) return;
  if (resizeTimer) window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    restarting = true;
    try { start(); } finally { restarting = false; }
  }, 120);
}

// Buttons
(document.getElementById('btnStart') as HTMLButtonElement).onclick = start;
(document.getElementById('btnStop') as HTMLButtonElement).onclick = stop;

// Window resize (debounced)
window.addEventListener('resize', scheduleRestart, { passive: true });

// Stage resize (letterboxing / flex changes)
const stage = document.getElementById('stage') as HTMLElement;
if (stage) {
  const ro = new ResizeObserver(() => scheduleRestart());
  ro.observe(stage);
}

// DPR / zoom changes also affect canvas pixels
let lastDpr = window.devicePixelRatio;
setInterval(() => {
  const dpr = window.devicePixelRatio;
  if (dpr !== lastDpr) { lastDpr = dpr; scheduleRestart(); }
}, 300);

window.addEventListener('coreMayhem:restart', () => {
  // mimic a manual Stop → Start so buttons/state stay consistent
  if (stopGame) {
    stop();
    start();
  }
});
