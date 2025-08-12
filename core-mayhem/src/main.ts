// main.ts
import { startGame } from './app/game';
import { updateHUD } from './render/hud';

// ——— Types ———
type StopFn = () => void;

// ——— State ———
let stopGame: StopFn | null = null;
let restarting = false;
let lastDpr = window.devicePixelRatio;
let dprIntervalId: number | null = null;

// Debounce helper with cancel()
function debounce<F extends (...args: any[]) => void>(fn: F, wait: number) {
  let t: number | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (t !== null) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), wait);
  };
  (debounced as any).cancel = () => {
    if (t !== null) {
      window.clearTimeout(t);
      t = null;
    }
  };
  return debounced as F & { cancel: () => void };
}

function init() {
  const canvas = document.getElementById('view') as HTMLCanvasElement | null;
  const btnStart = document.getElementById('btnStart') as HTMLButtonElement | null;
  const btnStop = document.getElementById('btnStop') as HTMLButtonElement | null;
  const stage = document.getElementById('stage') as HTMLElement | null;

  if (!canvas) {
    console.error('[core-mayhem] Missing <canvas id="view">');
    return;
  }
  if (!btnStart || !btnStop) {
    console.error('[core-mayhem] Missing start/stop buttons');
    return;
  }

  // Re-assert for TS so nested functions see them as HTMLCanvasElement / HTMLButtonElement
  const safeCanvas = canvas!;
  const safeBtnStart = btnStart!;
  const safeBtnStop = btnStop!;

  const scheduleRestart = debounce(() => {
    // Only restart if currently running; ignore if mid-restart
    if (!stopGame || restarting) return;
    restarting = true;
    try {
      start(); // re-reads current DPR, size, etc.
    } finally {
      restarting = false;
    }
  }, 120);

  function start() {
    // Stop previous run (if any)
    if (stopGame) {
      try {
        stopGame();
      } catch {
        /* ignore */
      }
      stopGame = null;
    }

    stopGame = startGame(safeCanvas);

    // Start DPR watcher when game is running
    lastDpr = window.devicePixelRatio;
    if (dprIntervalId !== null) window.clearInterval(dprIntervalId);
    dprIntervalId = window.setInterval(() => {
      const dpr = window.devicePixelRatio;
      if (dpr !== lastDpr) {
        lastDpr = dpr;
        scheduleRestart();
      }
    }, 300);

    // Toggle UI
    safeBtnStart.disabled = true;
    safeBtnStop.disabled = false;
  }

  function stop() {
    if (stopGame) {
      try {
        stopGame();
      } catch {
        /* ignore */
      }
    }
    stopGame = null;

    // Stop DPR watcher to avoid unnecessary work while stopped
    if (dprIntervalId !== null) {
      window.clearInterval(dprIntervalId);
      dprIntervalId = null;
    }
    // Cancel any queued restart so we don't "surprise start"
    scheduleRestart.cancel();

    updateHUD(); // keep HUD label in sync even if game.ts changes later
    safeBtnStart.disabled = false;
    safeBtnStop.disabled = true;
  }

  // Button wiring
  btnStart.onclick = start;
  btnStop.onclick = stop;

  // Window resize (debounced)
  window.addEventListener('resize', scheduleRestart, { passive: true });

  // Stage resize (letterboxing / flex changes)
  if (stage) {
    const ro = new ResizeObserver(() => scheduleRestart());
    ro.observe(stage);
  }

  // External “soft” restart (keeps UI consistent)
  window.addEventListener('coreMayhem:restart', () => {
    if (stopGame) {
      stop();
      start();
    }
  });

  // Optional: start automatically, or leave to the user
  // start();
}

// Ensure DOM elements exist before wiring
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
