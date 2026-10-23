import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { startNewMatch } from '../app/stats';
import { resetSimState, sim } from '../state';
import { coerceBoolean, runBatch } from '../tools/simBatch';
import { SIDE } from '../types';

afterEach(() => {
  vi.useRealTimers();
  resetSimState();
});

describe('coerceBoolean', () => {
  it('accepts JSON booleans and environment flag strings', () => {
    expect(coerceBoolean(true)).toBe(true);
    expect(coerceBoolean(false)).toBe(false);
    expect(coerceBoolean('true')).toBe(true);
    expect(coerceBoolean(' TRUE ')).toBe(true);
    expect(coerceBoolean('1')).toBe(true);
    expect(coerceBoolean('yes')).toBe(true);
    expect(coerceBoolean('on')).toBe(true);
    expect(coerceBoolean('false')).toBe(false);
    expect(coerceBoolean('FALSE')).toBe(false);
    expect(coerceBoolean('0')).toBe(false);
    expect(coerceBoolean('no')).toBe(false);
    expect(coerceBoolean('off')).toBe(false);
    expect(coerceBoolean('maybe')).toBeUndefined();
    expect(coerceBoolean('')).toBeUndefined();
    expect(coerceBoolean(1)).toBeUndefined();
    expect(coerceBoolean(null)).toBeUndefined();
    expect(coerceBoolean(undefined)).toBeUndefined();
  });
});

describe('runBatch timers', () => {
  function countPolls(): { polls: () => number } {
    let polls = 0;
    const real = globalThis.setInterval;
    vi.spyOn(globalThis, 'setInterval').mockImplementation(((fn: TimerHandler, ms?: number) => {
      if (ms === 10 && typeof fn === 'function') {
        return real(() => {
          polls += 1;
          fn();
        }, 10);
      }
      return real(fn, ms);
    }) as typeof setInterval);
    return { polls: () => polls };
  }

  it('clears the poll, deadline, and restart timer when the match ends', async () => {
    vi.useFakeTimers();
    const watch = countPolls();
    let restarts = 0;
    const onRestart = (): void => {
      restarts += 1;
    };
    window.addEventListener('coreMayhem:restart', onRestart);
    try {
      const pending = runBatch(
        { matches: 1, fullLength: false, primeVolley: false, hpScale: 1, timescale: 1 },
        () => {
          setTimeout(() => {
            sim.gameOver = true;
          }, 25);
          return {
            stop() {
              (sim as { restartTO?: unknown }).restartTO = setTimeout(() => {
                window.dispatchEvent(new CustomEvent('coreMayhem:restart'));
              }, 10_000);
            },
          };
        },
      );
      await vi.advanceTimersByTimeAsync(100);
      await pending;
      expect(sim.winner).toBeNull();
      expect((sim as { restartTO?: unknown }).restartTO).toBe(0);
      const pollsAfter = watch.polls();
      await vi.advanceTimersByTimeAsync(20_000);
      expect(watch.polls()).toBe(pollsAfter);
      expect(sim.winner).toBeNull();
      expect(restarts).toBe(0);
    } finally {
      window.removeEventListener('coreMayhem:restart', onRestart);
    }
  });

  it('forces a deadline winner for every requested match and leaves no timers', async () => {
    vi.useFakeTimers();
    const watch = countPolls();
    let restarts = 0;
    const onRestart = (): void => {
      restarts += 1;
    };
    window.addEventListener('coreMayhem:restart', onRestart);
    let boots = 0;
    try {
      const pending = runBatch(
        { matches: 2, fullLength: false, primeVolley: false, hpScale: 1, timescale: 1 },
        () => {
          boots += 1;
          startNewMatch();
          sim.coreL = { centerHP: boots === 1 ? 9 : 1, segHP: [0] } as typeof sim.coreL;
          sim.coreR = { centerHP: boots === 1 ? 2 : 8, segHP: [0] } as typeof sim.coreR;
          return {
            stop() {
              return;
            },
          };
        },
      );
      await vi.advanceTimersByTimeAsync(5000);
      const { summary } = await pending;
      expect(boots).toBe(2);
      expect(summary.matches).toBe(2);
      expect(summary.leftWins).toBe(1);
      expect(summary.rightWins).toBe(1);
      expect(summary.leftWins + summary.rightWins + summary.ties).toBe(summary.matches);
      expect((sim as { restartTO?: unknown }).restartTO).toBe(0);
      const pollsAfter = watch.polls();
      await vi.advanceTimersByTimeAsync(20_000);
      expect(watch.polls()).toBe(pollsAfter);
      expect(restarts).toBe(0);
    } finally {
      window.removeEventListener('coreMayhem:restart', onRestart);
    }
  });

  it('selects the deadline winner from remaining core HP', async () => {
    const cases: {
      centerL: number;
      segL: number[] | null;
      centerR: number;
      segR: number[] | null;
      winner: -1 | 0 | 1;
    }[] = [
      { centerL: 0, segL: [0], centerR: 0, segR: [0], winner: 0 },
      { centerL: 0, segL: [], centerR: 3, segR: [], winner: SIDE.RIGHT },
      { centerL: 3, segL: [], centerR: 0, segR: [], winner: SIDE.LEFT },
      { centerL: 2, segL: [2], centerR: 2, segR: [2], winner: 0 },
      { centerL: 1, segL: [4], centerR: 1, segR: [0], winner: SIDE.LEFT },
      { centerL: 1, segL: [0], centerR: 1, segR: [4], winner: SIDE.RIGHT },
      { centerL: 4, segL: null, centerR: 1, segR: null, winner: SIDE.LEFT },
    ];

    for (const entry of cases) {
      vi.useFakeTimers();
      const pending = runBatch(
        { matches: 1, fullLength: false, primeVolley: false, hpScale: 1 },
        () => {
          sim.coreL = { centerHP: 10, segHP: [] } as typeof sim.coreL;
          sim.coreR = { centerHP: 10, segHP: [] } as typeof sim.coreR;
          queueMicrotask(() => {
            sim.coreL!.centerHP = entry.centerL;
            sim.coreL!.segHP = entry.segL as number[];
            sim.coreR!.centerHP = entry.centerR;
            sim.coreR!.segHP = entry.segR as number[];
          });
          return {
            stop() {
              return;
            },
          };
        },
      );
      await vi.advanceTimersByTimeAsync(2000);
      await pending;
      expect(sim.winner).toBe(entry.winner);
      expect((sim as { restartTO?: unknown }).restartTO).toBe(0);
      vi.useRealTimers();
    }
  });

  it('ends a full-length match without a deadline winner', async () => {
    vi.useFakeTimers();
    const pending = runBatch(
      { matches: 1, fullLength: true, primeVolley: false, hpScale: 1 },
      () => {
        sim.coreL = { centerHP: 1, segHP: [] } as typeof sim.coreL;
        sim.coreR = { centerHP: 100, segHP: [] } as typeof sim.coreR;
        setTimeout(() => {
          sim.gameOver = true;
        }, 30);
        return {
          stop() {
            return;
          },
        };
      },
    );
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(sim.winner).toBeNull();
    await vi.advanceTimersByTimeAsync(5000);
    expect(sim.winner).toBeNull();
    expect((sim as { restartTO?: unknown }).restartTO).toBe(0);
  });

  it('finishes when core HP cannot be read', async () => {
    vi.useFakeTimers();
    const pending = runBatch(
      { matches: 1, fullLength: false, primeVolley: false, hpScale: 1 },
      () => {
        const trap = new Proxy(
          {},
          {
            get() {
              throw new Error('hp');
            },
          },
        );
        sim.coreL = trap as typeof sim.coreL;
        sim.coreR = trap as typeof sim.coreR;
        return {
          stop() {
            return;
          },
        };
      },
    );
    await vi.advanceTimersByTimeAsync(2000);
    await pending;
    expect(sim.gameOver).toBe(false);
    expect(sim.winner).toBeNull();
  });

  it('zeroes the restart handle when stop and clearTimeout fail', async () => {
    vi.useFakeTimers();
    let restartId: unknown = 0;
    const realClear = globalThis.clearTimeout;
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((id?: unknown) => {
      if (id != null && id === restartId) throw new Error('clear failed');
      return realClear(id as Parameters<typeof clearTimeout>[0]);
    }) as typeof clearTimeout);

    const pending = runBatch({ matches: 1, fullLength: true, primeVolley: false }, () => {
      setTimeout(() => {
        sim.gameOver = true;
      }, 0);
      return {
        stop() {
          restartId = setTimeout(() => {
            return;
          }, 5000);
          (sim as { restartTO?: unknown }).restartTO = restartId;
          throw new Error('stop failed');
        },
      };
    });
    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).resolves.toBeTruthy();
    expect((sim as { restartTO?: unknown }).restartTO).toBe(0);
  });

  it('does not leave a poll running when boot fails', async () => {
    vi.useFakeTimers();
    const watch = countPolls();
    await expect(
      runBatch({ matches: 1, fullLength: false, primeVolley: false }, () => {
        throw new Error('boot failed');
      }),
    ).rejects.toThrow('boot failed');
    expect(watch.polls()).toBe(0);
    expect((sim as { restartTO?: unknown }).restartTO).toBe(0);
  });
});

describe('simulate batch (harness)', () => {
  it('runs a configurable number of matches and writes CSVs', async () => {
    // Load config from batch.config.json (project root)
    const cfgPath = path.resolve(process.cwd(), 'batch.config.json');
    let cfg: Record<string, unknown> = {};
    try {
      if (fs.existsSync(cfgPath))
        cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as Record<string, unknown>;
    } catch {
      cfg = {};
    }

    const pick = <T>(env: unknown, cfgVal: T | undefined, fallback: T): T =>
      (env ?? cfgVal ?? fallback) as T;

    const matches = Number(pick(process.env.MATCHES, cfg.matches as number | undefined, 10)) | 0;
    const alt = pick<string | undefined>(
      process.env.ALT_ORDER,
      cfg.altOrderMode as string | undefined,
      undefined,
    );
    const mirror = coerceBoolean(pick(process.env.MIRROR, cfg.mirrorArena, undefined));
    const timescale = Number(pick(process.env.TIMESCALE, cfg.timescale as number | undefined, 3.0));
    const seed = pick<string | number | undefined>(
      process.env.SEED,
      cfg.seed as string | number | undefined,
      undefined,
    );
    const fullLength = coerceBoolean(pick(process.env.FULL_LENGTH, cfg.fullLength, false)) === true;
    const primeRaw = pick(process.env.PRIME_VOLLEY, cfg.primeVolley, undefined);
    const spawnRate = pick<string | number | undefined>(
      process.env.SPAWN_RATE,
      cfg.spawnRate as string | number | undefined,
      undefined,
    );
    const targetAmmo = pick<string | number | undefined>(
      process.env.TARGET_AMMO,
      cfg.targetAmmo as string | number | undefined,
      undefined,
    );
    const hpScale = pick<string | number | undefined>(
      process.env.HP_SCALE,
      cfg.hpScale as string | number | undefined,
      undefined,
    );
    const requested = matches > 0 ? matches : 50;

    const { summary, files } = await runBatch({
      matches: requested,
      altOrderMode: alt as 'LR' | 'RL' | 'alternateTick' | 'alternateMatch' | undefined,
      mirrorArena: mirror,
      timescale,
      seed: seed === undefined ? undefined : Number(seed),
      spawnRate: spawnRate === undefined ? undefined : Number(spawnRate),
      targetAmmo: targetAmmo === undefined ? undefined : Number(targetAmmo),
      hpScale: hpScale === undefined ? undefined : Number(hpScale),
      fullLength,
      primeVolley: primeRaw === undefined ? undefined : coerceBoolean(primeRaw) === true,
    });

    expect(summary.matches).toBe(requested);
    expect(summary.leftWins + summary.rightWins + summary.ties).toBe(summary.matches);

    // Write CSVs under stats/ with a timestamped prefix
    const outDir = path.resolve(process.cwd(), 'stats');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = `batch-${ts}`;
    for (const [name, data] of Object.entries(files)) {
      fs.writeFileSync(path.join(outDir, `${prefix}-${name}`), data, 'utf8');
    }

    // Also write a quick summary
    const summaryTxt = `matches=${summary.matches}\nleftWins=${summary.leftWins}\nrightWins=${summary.rightWins}\nties=${summary.ties}\n`;
    fs.writeFileSync(path.join(outDir, `${prefix}-summary.txt`), summaryTxt, 'utf8');

    // Sanity: we should have at least one file
    expect(Object.keys(files).length).toBeGreaterThan(0);
  }, 120_000);
});
