import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { startGame } from '../app/game';
import { DEFAULTS } from '../config';
import { buildAvatarCmds, setAvatarEmotion } from '../render/avatar';
import { setFixedSimClock } from '../sim/clock';
import { gameplayRandom, resetGameplayRng } from '../sim/rng';
import { resetSimState, sim } from '../state';
import { runBatch } from '../tools/simBatch';

function stubCanvas(): HTMLCanvasElement {
  document.body.innerHTML = '<canvas id="view" width="900" height="620"></canvas>';
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const realGet = canvas.getContext.bind(canvas);
  canvas.getContext = ((type: string) => {
    if (type !== '2d') return realGet(type);
    const noop = (): void => {
      return;
    };
    return new Proxy(
      { canvas, measureText: () => ({ width: 0 }) },
      { get: (target, key) => (key in target ? (target as never)[key] : noop) },
    );
  }) as typeof canvas.getContext;
  document.documentElement.style.setProperty('--left', '#5cf');
  document.documentElement.style.setProperty('--right', '#f76');
  return canvas;
}

describe('seeded gameplay', () => {
  it('builds the same arena for the same seed and ignores avatar draws', () => {
    const layout = (): number[] => {
      resetSimState();
      sim.matchIndex = 0;
      sim.settings = { ...DEFAULTS, seed: 99 };
      setFixedSimClock(true);
      const stop = startGame(stubCanvas());
      const spins = sim.rotors.map((rotor) => rotor.angularVelocity);
      const phases = sim.paddles.map((paddle) =>
        Number((paddle as { plugin?: { t?: number } }).plugin?.t),
      );
      stop();
      setFixedSimClock(false);
      return [...spins, ...phases];
    };
    expect(layout()).toEqual(layout());

    resetGameplayRng(5);
    const before = [gameplayRandom(), gameplayRandom(), gameplayRandom()];
    resetGameplayRng(5);
    setAvatarEmotion('L', 'near_death');
    buildAvatarCmds(1000, 900, 620);
    buildAvatarCmds(2000, 900, 620);
    expect([gameplayRandom(), gameplayRandom(), gameplayRandom()]).toEqual(before);
  });

  it('replays a fixed-step batch to the same outcome and statistics', async () => {
    const opts = {
      matches: 1,
      seed: 12345,
      timescale: 3,
      hpScale: 0.4,
      primeVolley: true,
      fullLength: false,
      spawnRate: 26,
      targetAmmo: 80,
      altOrderMode: 'LR' as const,
      mirrorArena: false,
    };
    const first = await runBatch(opts);
    const second = await runBatch(opts);
    expect(first.summary.matches).toBe(1);
    expect(second.summary).toEqual(first.summary);
    expect(second.files).toEqual(first.files);
  });
});

describe('simulate batch (harness)', () => {
  it('runs a configurable number of matches and writes CSVs', async () => {
    // Load config from batch.config.json (project root)
    const cfgPath = path.resolve(process.cwd(), 'batch.config.json');
    let cfg: any = {};
    try {
      if (fs.existsSync(cfgPath)) cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    } catch {
      cfg = {};
    }

    const pick = <T>(env: unknown, cfgVal: T | undefined, fallback: T): T =>
      (env ?? cfgVal ?? fallback) as T;

    const matches = Number(pick(process.env.MATCHES, cfg.matches, 10)) | 0;
    const alt = pick<string | undefined>(process.env.ALT_ORDER, cfg.altOrderMode, undefined) as any; // 'LR' | 'RL' | 'alternateTick' | 'alternateMatch'
    const mirror = pick<string | undefined>(process.env.MIRROR, cfg.mirrorArena, undefined);
    const timescale = Number(pick(process.env.TIMESCALE, cfg.timescale, 3.0));
    const seed = pick<string | undefined>(process.env.SEED, cfg.seed, undefined);
    const fullLength = String(pick(process.env.FULL_LENGTH, cfg.fullLength, false)) === 'true';
    const primeVolley = pick<string | undefined>(
      process.env.PRIME_VOLLEY,
      cfg.primeVolley,
      undefined,
    );
    const spawnRate = pick<string | undefined>(process.env.SPAWN_RATE, cfg.spawnRate, undefined);
    const targetAmmo = pick<string | undefined>(process.env.TARGET_AMMO, cfg.targetAmmo, undefined);
    const hpScale = pick<string | undefined>(process.env.HP_SCALE, cfg.hpScale, undefined);

    const { summary, files } = await runBatch({
      matches: matches > 0 ? matches : 50,
      altOrderMode: alt as any,
      mirrorArena: mirror === undefined ? undefined : mirror === 'true',
      timescale,
      seed: seed === undefined ? undefined : Number(seed),
      spawnRate: spawnRate === undefined ? undefined : Number(spawnRate),
      targetAmmo: targetAmmo === undefined ? undefined : Number(targetAmmo),
      hpScale: hpScale === undefined ? undefined : Number(hpScale),
      fullLength,
      primeVolley: primeVolley === undefined ? undefined : String(primeVolley) === 'true',
    });

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
