import { bootWithCanvas } from '../boot';
import { sim, resetSimState } from '../state';
import { DEFAULTS } from '../config';
import { buildCSVs, resetStats, getSummary, initStats } from '../app/stats';
import { fireCannon, fireLaser, fireMissiles, fireMortar } from '../sim/weapons';
import { SIDE } from '../types';
import { declareWinner } from '../app/systems/match';

export interface BatchOpts {
  matches: number;
  altOrderMode?: 'LR' | 'RL' | 'alternateTick' | 'alternateMatch';
  mirrorArena?: boolean;
  timescale?: number;
  seed?: number;
  // Optional pacing tweaks for faster runs
  spawnRate?: number;
  targetAmmo?: number;
  hpScale?: number; // 0..1 multiplier to core HP to speed up matches
  fullLength?: boolean; // if true, do not force early end
  primeVolley?: boolean; // if true, fire an opening volley and prime bins
}

// very forgiving 2D context stub for canvas
function ctxStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const NOOP: (...args: unknown[]) => void = () => {};
  return new Proxy(
    { canvas, measureText: () => ({ width: 0 }) },
    { get: (t, p) => (p in t ? (t as any)[p] : NOOP) },
  ) as unknown as CanvasRenderingContext2D;
}

function ensureDOM(): HTMLCanvasElement {
  // basic HUD and canvas
  document.body.innerHTML = `
    <div id="hud">
      <span id="fps"></span>
      <div id="score"></div>
    </div>
    <canvas id="view" width="900" height="620"></canvas>
  `;

  const canvas = document.getElementById('view') as HTMLCanvasElement;
  // stub 2d context
  const anyCanvas = canvas as any;
  if (!anyCanvas.__ctxStubInstalled) {
    const realGet = canvas.getContext.bind(canvas);
    (canvas as any).getContext = (type: string) => {
      if (type === '2d') return ctxStub(canvas);
      return realGet(type as any);
    };
    anyCanvas.__ctxStubInstalled = true;
  }

  // ensure HUD ids resolve if queried later
  const realGetEl = document.getElementById.bind(document);
  (document as any)._getElPatched || ((document as any)._getElPatched = (() => {
    (document as any).getElementById = (id: string) => {
      const found = realGetEl(id);
      if (found) return found;
      const hud = realGetEl('hud') ?? document.body;
      const span = document.createElement('span');
      span.id = id;
      hud.appendChild(span);
      return span;
    };
    return true;
  })());

  // css var colors used by game code
  document.documentElement.style.setProperty('--left', '#5cf');
  document.documentElement.style.setProperty('--right', '#f76');
  return canvas;
}

async function runOne(canvas: HTMLCanvasElement, opts: BatchOpts): Promise<void> {
  // Refresh state for a clean match
  resetSimState();
  (sim as any).settings = {
    ...DEFAULTS,
    ...(typeof opts.seed === 'number' ? { seed: opts.seed } : {}),
    ...(opts.altOrderMode ? { altOrderMode: opts.altOrderMode } : {}),
    ...(typeof opts.mirrorArena === 'boolean' ? { mirrorArena: opts.mirrorArena } : {}),
    ...(typeof opts.timescale === 'number' ? { timescale: opts.timescale } : {}),
    ...(typeof opts.spawnRate === 'number' ? { spawnRate: opts.spawnRate } : {}),
    ...(typeof opts.targetAmmo === 'number' ? { targetAmmo: opts.targetAmmo } : {}),
  } as any;

  const { stop } = bootWithCanvas(canvas);

  // Optional: reduce core HP to accelerate match resolution
  const hpScale = Math.max(0.05, Math.min(1, opts.hpScale ?? (opts.fullLength ? 1 : 0.5)));
  try {
    const cL: any = (sim as any).coreL;
    const cR: any = (sim as any).coreR;
    const wepL: any = (sim as any).wepL;
    const wepR: any = (sim as any).wepR;
    if (cL) {
      cL.centerHP = Math.max(1, Math.round((cL.centerHP | 0) * hpScale));
      if (Array.isArray(cL.segHP)) cL.segHP = cL.segHP.map((v: number) => Math.max(1, Math.round(v * hpScale)));
    }
    if (cR) {
      cR.centerHP = Math.max(1, Math.round((cR.centerHP | 0) * hpScale));
      if (Array.isArray(cR.segHP)) cR.segHP = cR.segHP.map((v: number) => Math.max(1, Math.round(v * hpScale)));
    }
    // Fire an opening volley immediately to accelerate first contact (optional)
    if ((opts.primeVolley ?? !opts.fullLength) && wepL && wepR && cL && cR) {
      try {
        fireCannon(SIDE.LEFT as any, wepL.cannon.pos, cR.center, 18);
        fireLaser(SIDE.LEFT as any, wepL.laser.pos, cR as any);
        fireMissiles(SIDE.LEFT as any, wepL.missile.pos, 5);
        fireMortar(SIDE.LEFT as any, wepL.mortar.pos, 1);

        fireCannon(SIDE.RIGHT as any, wepR.cannon.pos, cL.center, 18);
        fireLaser(SIDE.RIGHT as any, wepR.laser.pos, cL as any);
        fireMissiles(SIDE.RIGHT as any, wepR.missile.pos, 5);
        fireMortar(SIDE.RIGHT as any, wepR.mortar.pos, 1);
      } catch {}
    }
    // Prime bins to trigger next volleys quickly (optional)
    if (opts.primeVolley ?? !opts.fullLength) {
      const prime = (bins: any) => {
        if (!bins) return;
        for (const k of ['cannon','laser','missile','mortar']) {
          if (bins[k]) bins[k].fill = bins[k].cap;
        }
      };
      prime((sim as any).binsL);
      prime((sim as any).binsR);
    }
  } catch {
    // ignore
  }

  // Poll until gameOver
  await new Promise<void>((resolve) => {
    const startDeadline = (): ReturnType<typeof setTimeout> | null =>
      opts.fullLength
        ? null
        : setTimeout(() => {
            // Forced end if taking too long: pick winner by current HP
            try {
              const cL: any = (sim as any).coreL;
              const cR: any = (sim as any).coreR;
              const sumSeg = (arr: number[] | null | undefined) => (Array.isArray(arr) ? arr.reduce((a, b) => a + (b | 0), 0) : 0);
              const lhs = (cL?.centerHP | 0) + sumSeg(cL?.segHP);
              const rhs = (cR?.centerHP | 0) + sumSeg(cR?.segHP);
              if (lhs <= 0 && rhs <= 0) declareWinner(0 as any);
              else if (lhs <= 0) declareWinner(SIDE.RIGHT as any);
              else if (rhs <= 0) declareWinner(SIDE.LEFT as any);
              else declareWinner(lhs > rhs ? (SIDE.LEFT as any) : (rhs > lhs ? (SIDE.RIGHT as any) : (0 as any)));
            } catch {}
            resolve();
          }, 2000);
    const deadline = startDeadline();
    const id = setInterval(() => {
      if ((sim as any).gameOver) {
        clearInterval(id);
        if (deadline) clearTimeout(deadline);
        resolve();
      }
    }, 10);
  });

  // Stop and cleanup
  try { stop(); } catch {}
  // Clear any pending auto-restart timeout
  try { if ((sim as any).restartTO) clearTimeout((sim as any).restartTO); } catch {}
}

export async function runBatch(opts: BatchOpts): Promise<{ summary: ReturnType<typeof getSummary> } & { files: Record<string, string> }> {
  const canvas = ensureDOM();
  // fresh stats session
  resetStats();
  initStats();

  const N = Math.max(1, opts.matches | 0);
  for (let i = 0; i < N; i++) {
    // vary seed a bit if provided; otherwise let defaults roll
    const seed = typeof opts.seed === 'number' ? (opts.seed + i * 1337) | 0 : undefined;
    await runOne(canvas, { ...opts, seed });
  }

  const summary = getSummary();
  const files = buildCSVs();
  return { summary, files };
}
