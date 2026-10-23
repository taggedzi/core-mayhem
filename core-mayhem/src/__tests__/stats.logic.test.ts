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
  STATS_RETENTION,
  getPersistenceStatus,
  recordMissileFirstImpact,
  recordMissileCoreDelay,
} from '../app/stats';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';
import { initStatsOverlay, openStatsOverlay } from '../ui/stats';

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
});

describe('bounded statistics persistence', () => {
  // happy-dom's setItem spy is not always undone by restoreAllMocks. Bind the
  // original before any spy so a later test can put it back.
  const nativeSetItem = localStorage.setItem.bind(localStorage);
  const restoreSetItem = (): void => {
    Object.defineProperty(localStorage, 'setItem', {
      value: nativeSetItem,
      writable: true,
      configurable: true,
    });
  };

  beforeEach(() => {
    restoreSetItem();
    vi.useFakeTimers();
    resetStats();
    vi.runAllTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreSetItem();
    resetStats();
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('keeps only the newest match histories', () => {
    for (let i = 0; i < STATS_RETENTION.matches + 5; i++) {
      startNewMatch();
      (sim as any).winner = SIDE.LEFT;
      (sim as any).winnerAt = 1_000 + i;
      recordMatchEnd();
    }
    const rows = buildCSVs()['matches.csv'].trim().split('\n').slice(1);
    expect(rows).toHaveLength(STATS_RETENTION.matches);
    expect(rows[0]?.startsWith('6,')).toBe(true);
    expect(getSummary().matches).toBe(STATS_RETENTION.matches);
  });

  it('does not serialize match history when missiles and buffs are recorded', () => {
    startNewMatch();
    recordShotFired(SIDE.LEFT, 'cannon');
    (sim as any).winner = SIDE.LEFT;
    (sim as any).winnerAt = 2_000;
    recordMatchEnd();
    vi.runAllTimers();
    const compact = localStorage.getItem('coreMayhem.stats.v1');
    const history = localStorage.getItem('coreMayhem.stats.history.v1');
    expect(compact).toEqual(expect.any(String));
    expect(compact).not.toContain('"matches"');
    expect(history).toEqual(expect.any(String));
    expect(history).toContain('"matches"');

    const setItem = vi.spyOn(localStorage, 'setItem');
    startNewMatch();
    for (let i = 0; i < 25; i++) recordMissileFirstImpact(SIDE.LEFT, 'coreCenter');
    recordBuff(SIDE.LEFT, 'damage');
    vi.runAllTimers();
    const keys = setItem.mock.calls.map((call) => String(call[0]));
    const payloads = setItem.mock.calls.map((call) => String(call[1]));
    expect(payloads.length).toBeGreaterThan(0);
    expect(keys).not.toContain('coreMayhem.stats.history.v1');
    for (const payload of payloads) expect(payload).not.toContain('"matches"');

    const impacts = buildCSVs()['missile_first_impacts.csv'].trim().split('\n').slice(1);
    expect(impacts).toHaveLength(25);
  });

  it('reports storage failures without dropping recorded totals', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    recordBuff(SIDE.LEFT, 'damage');
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(getPersistenceStatus()).toEqual({ ok: false, message: 'QuotaExceededError' });
    expect(getSummary().buffsL).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    recordBuff(SIDE.LEFT, 'damage');
    vi.runAllTimers();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(getSummary().buffsL).toBe(2);

    initStatsOverlay();
    openStatsOverlay();
    expect(document.body.textContent).toContain('Statistics could not be saved');
    expect(document.body.textContent).toContain('QuotaExceededError');
  });

  it('caps missile core delays and ignores samples from outside a match', () => {
    recordMissileCoreDelay(SIDE.LEFT, 40);
    recordMissileFirstImpact(SIDE.LEFT, 'coreCenter');
    startNewMatch();
    recordMissileCoreDelay(SIDE.LEFT, -8);
    for (let i = 0; i < STATS_RETENTION.missileCoreDelays; i++) {
      recordMissileCoreDelay(SIDE.RIGHT, 10 + i);
    }
    const rows = buildCSVs()['missile_core_delays.csv'].trim().split('\n').slice(1);
    expect(rows).toHaveLength(STATS_RETENTION.missileCoreDelays);
    expect(rows[0]).toBe('1,R,10');
    expect(rows.at(-1)).toBe(`1,R,${10 + STATS_RETENTION.missileCoreDelays - 1}`);
    expect(buildCSVs()['missile_first_impacts.csv'].trim().split('\n').slice(1)).toEqual([]);
  });

  it('still saves after a queued write is discarded', () => {
    recordBuff(SIDE.LEFT, 'damage');
    vi.useRealTimers();
    vi.useFakeTimers();
    resetStats();
    vi.runAllTimers();
    expect(localStorage.getItem('coreMayhem.stats.v1')).toEqual(expect.any(String));
    expect(getSummary().buffsL).toBe(0);
  });

  it('describes storage failures that are not Error objects', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw 'disk full';
    });
    recordBuff(SIDE.LEFT, 'damage');
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(getPersistenceStatus()).toEqual({
      ok: false,
      message: 'Statistics could not be saved',
    });
    expect(getSummary().buffsL).toBe(1);
  });

  it('splits a legacy combined save onto the history key', async () => {
    startNewMatch();
    recordShotFired(SIDE.LEFT, 'cannon');
    (sim as any).winner = SIDE.LEFT;
    (sim as any).winnerAt = 3_000;
    recordMatchEnd();
    vi.runAllTimers();

    const compact = JSON.parse(localStorage.getItem('coreMayhem.stats.v1') ?? '');
    const history = JSON.parse(localStorage.getItem('coreMayhem.stats.history.v1') ?? '');
    localStorage.setItem('coreMayhem.stats.v1', JSON.stringify({ ...compact, ...history }));
    localStorage.removeItem('coreMayhem.stats.history.v1');

    vi.resetModules();
    const restored = await import('../app/stats');
    restored.initStats();
    expect(restored.getSummary().matches).toBe(1);
    vi.runAllTimers();
    const split = localStorage.getItem('coreMayhem.stats.v1');
    const hist = localStorage.getItem('coreMayhem.stats.history.v1');
    expect(split).toEqual(expect.any(String));
    expect(split).not.toContain('"matches"');
    expect(hist).toEqual(expect.any(String));
    expect(hist).toContain('"matches"');
    expect(hist).toContain('"missileCoreDelays"');
  });

  it('reloads detailed history saved under its own key', async () => {
    startNewMatch();
    (sim as any).winner = SIDE.RIGHT;
    (sim as any).winnerAt = 4_000;
    recordMatchEnd();
    vi.runAllTimers();

    vi.resetModules();
    const restored = await import('../app/stats');
    restored.initStats();
    expect(restored.getSummary().matches).toBe(1);
    expect(restored.getSummary().rightWins).toBe(1);
    expect(restored.buildCSVs()['matches.csv']).toContain(',1,');
  });

  it('reports unreadable saved statistics without throwing', async () => {
    localStorage.setItem('coreMayhem.stats.v1', '{');
    vi.resetModules();
    const restored = await import('../app/stats');
    expect(() => restored.initStats()).not.toThrow();
    expect(restored.getPersistenceStatus().ok).toBe(false);
    expect(restored.getSummary().matches).toBe(0);
  });
});
