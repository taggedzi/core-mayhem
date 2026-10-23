import { buildCSVs, resetStats, getSummary, initStats } from '../app/stats';
import { declareWinner } from '../app/systems/match';
import { bootWithCanvas } from '../boot';
import { DEFAULTS } from '../config';
import { fireCannon, fireLaser, fireMissiles, fireMortar } from '../sim/weapons';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

const TRUE_FLAGS = new Set(['true', '1', 'yes', 'on']);
const FALSE_FLAGS = new Set(['false', '0', 'no', 'off']);

/** Accept a JSON boolean or an environment string such as "true" or "false". */
export function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const text = value.trim().toLowerCase();
  if (TRUE_FLAGS.has(text)) return true;
  if (FALSE_FLAGS.has(text)) return false;
  return undefined;
}

interface BatchOpts {
  matches: number;
  altOrderMode?: 'LR' | 'RL' | 'alternateTick' | 'alternateMatch' | undefined;
  mirrorArena?: boolean | undefined;
  timescale?: number | undefined;
  seed?: number | undefined;
  // Optional pacing tweaks for faster runs
  spawnRate?: number | undefined;
  targetAmmo?: number | undefined;
  hpScale?: number | undefined; // 0..1 multiplier to core HP to speed up matches
  fullLength?: boolean | undefined; // if true, do not force early end
  primeVolley?: boolean | undefined; // if true, fire an opening volley and prime bins
}

// very forgiving 2D context stub for canvas
function ctxStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const NOOP: (..._args: unknown[]) => void = () => {
    return;
  };
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
  if (!(document as any)._getElPatched) {
    (document as any).getElementById = (id: string) => {
      const found = realGetEl(id);
      if (found) return found;
      const hud = realGetEl('hud') ?? document.body;
      const span = document.createElement('span');
      span.id = id;
      hud.appendChild(span);
      return span;
    };
    (document as any)._getElPatched = true;
  }

  // css var colors used by game code
  document.documentElement.style.setProperty('--left', '#5cf');
  document.documentElement.style.setProperty('--right', '#f76');
  return canvas;
}

type BootFn = (canvas: HTMLCanvasElement) => { stop: () => void };

async function runOne(canvas: HTMLCanvasElement, opts: BatchOpts, boot: BootFn): Promise<void> {
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

  let stop: () => void = () => {
    return;
  };
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let deadlineId: ReturnType<typeof setTimeout> | undefined;
  const clearWatch = (): void => {
    clearInterval(intervalId);
    clearTimeout(deadlineId);
    intervalId = undefined;
    deadlineId = undefined;
  };

  try {
    ({ stop } = boot(canvas));

    // Optional: reduce core HP to accelerate match resolution
    const hpScale = Math.max(0.05, Math.min(1, opts.hpScale ?? (opts.fullLength ? 1 : 0.5)));
    try {
      const cL: any = (sim as any).coreL;
      const cR: any = (sim as any).coreR;
      const wepL: any = (sim as any).wepL;
      const wepR: any = (sim as any).wepR;
      if (cL) {
        cL.centerHP = Math.max(1, Math.round((cL.centerHP | 0) * hpScale));
        if (Array.isArray(cL.segHP))
          cL.segHP = cL.segHP.map((v: number) => Math.max(1, Math.round(v * hpScale)));
      }
      if (cR) {
        cR.centerHP = Math.max(1, Math.round((cR.centerHP | 0) * hpScale));
        if (Array.isArray(cR.segHP))
          cR.segHP = cR.segHP.map((v: number) => Math.max(1, Math.round(v * hpScale)));
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
        } catch {
          /* ignore */ void 0;
        }
      }
      // Prime bins to trigger next volleys quickly (optional)
      if (opts.primeVolley ?? !opts.fullLength) {
        const prime = (bins: any): void => {
          if (!bins) return;
          for (const k of ['cannon', 'laser', 'missile', 'mortar']) {
            if (bins[k]) bins[k].fill = bins[k].cap;
          }
        };
        prime((sim as any).binsL);
        prime((sim as any).binsR);
      }
    } catch {
      /* ignore */ void 0;
    }

    // Poll until gameOver. The deadline used to resolve without clearing this
    // interval, so the next match could reset gameOver and leave the poll running.
    await new Promise<void>((resolve) => {
      const finish = (): void => {
        clearWatch();
        resolve();
      };
      if (!opts.fullLength) {
        deadlineId = setTimeout(() => {
          // Forced end if taking too long: pick winner by current HP
          try {
            const cL: any = (sim as any).coreL;
            const cR: any = (sim as any).coreR;
            const sumSeg = (arr: number[] | null | undefined): number =>
              Array.isArray(arr) ? arr.reduce((a, b) => a + (b | 0), 0) : 0;
            const lhs = (cL?.centerHP | 0) + sumSeg(cL?.segHP);
            const rhs = (cR?.centerHP | 0) + sumSeg(cR?.segHP);
            if (lhs <= 0 && rhs <= 0) declareWinner(0 as any);
            else if (lhs <= 0) declareWinner(SIDE.RIGHT as any);
            else if (rhs <= 0) declareWinner(SIDE.LEFT as any);
            else
              declareWinner(
                lhs > rhs ? (SIDE.LEFT as any) : rhs > lhs ? (SIDE.RIGHT as any) : (0 as any),
              );
          } catch {
            /* ignore */ void 0;
          }
          finish();
        }, 2000);
      }
      intervalId = setInterval(() => {
        if ((sim as any).gameOver) finish();
      }, 10);
    });
  } finally {
    try {
      stop();
    } catch {
      /* ignore */ void 0;
    }
    // Drop the auto-restart handle and zero it so the next match can arm a new one.
    try {
      const pending = (sim as any).restartTO;
      if (pending) clearTimeout(pending);
    } catch {
      /* ignore */ void 0;
    }
    (sim as any).restartTO = 0;
    clearWatch();
  }
}

export async function runBatch(
  opts: BatchOpts,
  boot: BootFn = bootWithCanvas,
): Promise<{ summary: ReturnType<typeof getSummary> } & { files: Record<string, string> }> {
  const canvas = ensureDOM();
  // fresh stats session
  resetStats();
  initStats();

  const N = Math.max(1, opts.matches | 0);
  for (let i = 0; i < N; i++) {
    // vary seed a bit if provided; otherwise let defaults roll
    const seed = typeof opts.seed === 'number' ? (opts.seed + i * 1337) | 0 : undefined;
    await runOne(canvas, { ...opts, seed }, boot);
  }

  const summary = getSummary();
  const files = buildCSVs();
  return { summary, files };
}
