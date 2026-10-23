import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  initStats,
  startNewMatch,
  recordShotFired,
  recordMiss,
  recordProjectileHit,
  recordLaserHit,
  recordBinDeposit,
  recordBinCap,
  recordMatchEnd,
  recordBuff,
  recordDebuff,
  getSummary,
  buildCSVs,
  resetStats,
  abortOpenMatch,
} from '../app/stats';
import { getScoreData } from '../render/scoreModel';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

describe('persisted statistics compatibility', () => {
  it.each([
    null,
    {},
    { weapon: {}, bins: {}, buffCounts: {}, debuffCounts: {}, matches: 'invalid' },
  ])('restores incomplete saved data: %j', async (saved) => {
    vi.resetModules();
    vi.useFakeTimers();
    localStorage.setItem('coreMayhem.stats.v1', JSON.stringify(saved));
    try {
      const stats = await import('../app/stats');
      stats.initStats();
      expect(stats.getSummary().matches).toBe(0);
      const files = stats.buildCSVs();
      expect(Object.keys(files).length).toBeGreaterThan(0);
      vi.runAllTimers();
    } finally {
      localStorage.removeItem('coreMayhem.stats.v1');
      vi.useRealTimers();
    }
  });

  it('round-trips populated statistics without losing weapon counters', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    localStorage.removeItem('coreMayhem.stats.v1');
    try {
      const initial = await import('../app/stats');
      initial.initStats();
      initial.recordShotFired(SIDE.LEFT, 'cannon');
      vi.runAllTimers();
      vi.resetModules();
      const restored = await import('../app/stats');
      restored.initStats();
      expect(restored.buildCSVs()).toEqual(initial.buildCSVs());
    } finally {
      localStorage.removeItem('coreMayhem.stats.v1');
      vi.useRealTimers();
    }
  });

  it('reloads header and panel from the same saved results', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    localStorage.removeItem('coreMayhem.stats.v1');
    try {
      const state = await import('../state');
      const initial = await import('../app/stats');
      const score = await import('../render/scoreModel');
      initial.resetStats();
      (state.sim as any).matchStart = 1_000;
      (state.sim as any).winner = SIDE.LEFT;
      (state.sim as any).winnerAt = 1_500;
      initial.startNewMatch();
      initial.recordMatchEnd();
      vi.runAllTimers();
      expect(score.getScoreData()).toEqual({ leftWins: 1, rightWins: 0, ties: 0 });

      vi.resetModules();
      const restored = await import('../app/stats');
      const restoredScore = await import('../render/scoreModel');
      restored.initStats();
      expect(restored.getSummary()).toMatchObject({ matches: 1, leftWins: 1, ties: 0 });
      expect(restoredScore.getScoreData()).toEqual({ leftWins: 1, rightWins: 0, ties: 0 });
      restored.resetStats();
      expect(restored.getSummary()).toMatchObject({ matches: 0, leftWins: 0, ties: 0 });
      expect(restoredScore.getScoreData()).toEqual({ leftWins: 0, rightWins: 0, ties: 0 });
    } finally {
      localStorage.removeItem('coreMayhem.stats.v1');
      vi.useRealTimers();
    }
  });
});

describe('stats recording + CSVs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStats();
    resetSimState();
    // deterministic timestamps
    vi.setSystemTime(new Date(2024, 0, 1, 0, 0, 0));
    (sim as any).matchStart = performance.now();
  });

  it('records events across a match and exports CSVs', () => {
    initStats();
    startNewMatch();

    // Weapon shots/misses and hits
    recordShotFired(SIDE.LEFT, 'cannon');
    recordMiss(SIDE.LEFT, 'cannon');
    recordProjectileHit(SIDE.LEFT, 'cannon', 5, 3, 0, (sim as any).matchStart + 1200);
    recordLaserHit(SIDE.RIGHT, 2, 0, 4, (sim as any).matchStart + 2300);

    // Bin activity
    recordBinDeposit(SIDE.LEFT, 'buff', 10, (sim as any).matchStart + 500);
    recordBinDeposit(SIDE.LEFT, 'buff', 5, (sim as any).matchStart + 600);
    recordBinCap(SIDE.LEFT, 'buff', (sim as any).matchStart + 1000);

    // Buff/debuff tallies
    recordBuff(SIDE.LEFT, 'damage');
    recordDebuff(SIDE.RIGHT, 'laser');

    // Match end snapshot
    (sim as any).winner = SIDE.LEFT;
    (sim as any).winnerAt = (sim as any).matchStart + 5000;
    (sim as any).coreL = { segHP: [1, 2, 3], centerHP: 400, shieldHP: 50 } as any;
    (sim as any).coreR = { segHP: [0, 0, 0], centerHP: 0, shieldHP: 0 } as any;

    recordMatchEnd();

    const summary = getSummary();
    expect(summary.matches).toBeGreaterThan(0);
    expect(summary.leftWins).toBe(1);
    expect(summary.buffsL).toBeGreaterThan(0);
    expect(summary.debuffsR).toBeGreaterThan(0);

    const files = buildCSVs();
    // basic sanity of CSV contents
    expect(files['weapon_agg.csv']).toMatch(/shots/);
    expect(files['bin_cycles.csv']).toMatch(/cycles/);
    expect(files['matches.csv']).toMatch(/matchId/);
    expect(files['mods_agg.csv']).toMatch(/type,side,kind,count/);
    expect(files['mods_per_match.csv']).toMatch(/matchId,type,side,kind,count/);
    expect(files['first_hits.csv']).toMatch(/msToFirstHit/);
    expect(files['damage_timeline.csv']).toMatch(/dmgShield/);
  });

  it('keeps recording a live match after reset and agrees with the header', () => {
    initStats();
    startNewMatch();
    recordShotFired(SIDE.LEFT, 'cannon');
    resetStats();
    recordShotFired(SIDE.LEFT, 'cannon');
    recordProjectileHit(SIDE.LEFT, 'cannon', 1.5, 2.25, 0, (sim as any).matchStart + 1500);
    (sim as any).winner = SIDE.RIGHT;
    (sim as any).winnerAt = (sim as any).matchStart + 2000;
    recordMatchEnd();

    const summary = getSummary();
    expect(summary.matches).toBe(1);
    expect(summary.rightWins).toBe(1);
    expect(summary.ties).toBe(0);
    expect(getScoreData()).toEqual({
      leftWins: summary.leftWins,
      rightWins: summary.rightWins,
      ties: summary.ties,
    });
    const files = buildCSVs();
    expect(files['weapon_agg.csv']).toMatch(/L,cannon,1,/);
    expect(files['damage_timeline.csv']).toMatch(/1,1,L,cannon,1\.50,2\.25,0\.00/);
    expect(files['matches.csv']).toMatch(/,1,/);
  });

  it('drops an unfinished stop without counting a tie, then records the next match', () => {
    initStats();
    startNewMatch();
    recordProjectileHit(SIDE.LEFT, 'cannon', 4, 0, 0, (sim as any).matchStart + 100);
    abortOpenMatch();
    expect(getSummary()).toMatchObject({ matches: 0, ties: 0, leftWins: 0, rightWins: 0 });
    const dropped = buildCSVs()['damage_timeline.csv'].trim().split('\n');
    expect(dropped).toHaveLength(1);

    startNewMatch();
    recordProjectileHit(SIDE.RIGHT, 'laser', 0, 0, 3, (sim as any).matchStart + 400);
    (sim as any).winner = SIDE.LEFT;
    (sim as any).winnerAt = (sim as any).matchStart + 800;
    recordMatchEnd();
    expect(getSummary()).toMatchObject({ matches: 1, leftWins: 1, ties: 0 });
    const timeline = buildCSVs()['damage_timeline.csv'];
    expect(timeline).toMatch(/R,laser,0\.00,0\.00,3\.00/);
    expect(timeline).not.toMatch(/cannon,4\.00/);
  });
});
