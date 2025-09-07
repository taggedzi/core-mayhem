import { describe, it, expect } from 'vitest';
import { runBatch } from '../tools/simBatch';
import fs from 'node:fs';
import path from 'node:path';

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

    const pick = <T>(env: string | undefined, cfgVal: T | undefined, fallback: T): T =>
      (env !== undefined ? (env as any) : (cfgVal !== undefined ? cfgVal : fallback)) as T;

    const matches = Number(pick(process.env.MATCHES, cfg.matches, 10)) | 0;
    const alt = pick<string | undefined>(process.env.ALT_ORDER, cfg.altOrderMode, undefined) as any; // 'LR' | 'RL' | 'alternateTick' | 'alternateMatch'
    const mirror = pick<string | undefined>(process.env.MIRROR, cfg.mirrorArena, undefined);
    const timescale = Number(pick(process.env.TIMESCALE, cfg.timescale, 3.0));
    const seed = pick<string | undefined>(process.env.SEED, cfg.seed, undefined);
    const fullLength = String(pick(process.env.FULL_LENGTH, cfg.fullLength, false)) === 'true';
    const primeVolley = pick<string | undefined>(process.env.PRIME_VOLLEY, cfg.primeVolley, undefined);
    const spawnRate = pick<string | undefined>(process.env.SPAWN_RATE, cfg.spawnRate, undefined);
    const targetAmmo = pick<string | undefined>(process.env.TARGET_AMMO, cfg.targetAmmo, undefined);
    const hpScale = pick<string | undefined>(process.env.HP_SCALE, cfg.hpScale, undefined);

    const { summary, files } = await runBatch({
      matches: matches > 0 ? matches : 50,
      altOrderMode: alt as any,
      mirrorArena: mirror === undefined ? undefined : mirror === 'true' || mirror === true,
      timescale,
      seed: seed === undefined ? undefined : Number(seed),
      spawnRate: spawnRate === undefined ? undefined : Number(spawnRate),
      targetAmmo: targetAmmo === undefined ? undefined : Number(targetAmmo),
      hpScale: hpScale === undefined ? undefined : Number(hpScale),
      fullLength,
      primeVolley: primeVolley === undefined ? undefined : (String(primeVolley) === 'true'),
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
