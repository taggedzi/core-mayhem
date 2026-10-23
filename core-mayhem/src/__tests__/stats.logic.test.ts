import Matter, { Bodies, World } from 'matter-js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { registerCollisions } from '../app/collisions';
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
} from '../app/stats';
import { runTriggers } from '../app/systems/triggers';
import { fireLaser } from '../sim/weapons';
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

function csvRow(csv: string, prefix: string): Record<string, string> {
  const [header, ...lines] = csv.trim().split('\n');
  const cols = header.split(',');
  const line = lines.find((row) => row.startsWith(prefix));
  expect(line, prefix).toBeTruthy();
  const vals = line!.split(',');
  return Object.fromEntries(cols.map((col, i) => [col, vals[i] ?? '']));
}

function addBody(body: Matter.Body): Matter.Body {
  World.add(sim.world as Matter.World, body);
  return body;
}

describe('combat statistics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStats();
    resetSimState();
    const eng = Matter.Engine.create();
    sim.engine = eng;
    sim.world = eng.world;
    (sim as any).matchStart = 1_000;
    (sim as any).coreL = {
      center: { x: 100, y: 100 },
      segHP: [1.2, 2.3],
      segHPmax: 100,
      centerHP: 4.5,
      centerHPmax: 400,
      shieldHP: 0.25,
      shieldHPmax: 200,
    };
    (sim as any).coreR = {
      center: { x: 540, y: 100 },
      segHP: new Array(8).fill(100),
      segHPmax: 100,
      centerHP: 20.4,
      centerHPmax: 400,
      shieldHP: 40.5,
      shieldHPmax: 200,
    };
    (sim as any).binsL = {
      cannon: { fill: 0, cap: 10 },
      laser: { fill: 0, cap: 10 },
      missile: { fill: 0, cap: 10 },
      mortar: { fill: 0, cap: 10 },
      repair: { fill: 0, cap: 10 },
      shield: { fill: 0, cap: 10 },
      buff: { fill: 1, cap: 1 },
      debuff: { fill: 1, cap: 1 },
    };
    (sim as any).binsR = {
      cannon: { fill: 0, cap: 10 },
      laser: { fill: 0, cap: 10 },
      missile: { fill: 0, cap: 10 },
      mortar: { fill: 0, cap: 10 },
      repair: { fill: 0, cap: 10 },
      shield: { fill: 0, cap: 10 },
      buff: { fill: 0, cap: 10 },
      debuff: { fill: 0, cap: 10 },
    };
    (sim as any).wepL = {
      cannon: { pos: { x: 20, y: 20 } },
      laser: { pos: { x: 25, y: 25 } },
      missile: { pos: { x: 30, y: 30 } },
      mortar: { pos: { x: 35, y: 35 } },
    };
    (sim as any).cooldowns = {
      L: { cannon: 0, laser: 0, missile: 0, mortar: 0 },
      R: { cannon: 0, laser: 0, missile: 0, mortar: 0 },
    };
    startNewMatch();
  });

  it('records shield and penetrating damage once, including fractions', () => {
    const det = registerCollisions(sim.engine!);
    const center = addBody(Bodies.circle(540, 100, 8, { isSensor: true }));
    (center as any).plugin = { kind: 'coreCenter', side: SIDE.RIGHT };

    recordShotFired(SIDE.LEFT, 'cannon');
    const absorbed = addBody(Bodies.circle(520, 100, 3));
    (absorbed as any).plugin = {
      kind: 'projectile',
      ptype: 'cannon',
      side: SIDE.LEFT,
      dmg: 10.25,
      spawnT: 0,
    };
    Matter.Events.trigger(sim.engine as any, 'collisionStart', {
      pairs: [{ bodyA: absorbed, bodyB: center }],
    } as any);
    expect((sim as any).coreR.shieldHP).toBeCloseTo(30.25);
    expect((sim as any).coreR.centerHP).toBeCloseTo(20.4);

    (sim as any).coreR.shieldHP = 5.25;
    recordShotFired(SIDE.LEFT, 'cannon');
    const breaking = addBody(Bodies.circle(520, 100, 3));
    (breaking as any).plugin = {
      kind: 'projectile',
      ptype: 'cannon',
      side: SIDE.LEFT,
      dmg: 10.75,
      spawnT: 0,
    };
    Matter.Events.trigger(sim.engine as any, 'collisionStart', {
      pairs: [{ bodyA: breaking, bodyB: center }],
    } as any);

    expect((sim as any).coreR.shieldHP).toBe(0);
    expect((sim as any).coreR.centerHP).toBeCloseTo(14.9);

    const row = csvRow(buildCSVs()['weapon_agg.csv'], 'L,cannon,');
    expect(row.shots).toBe('2');
    expect(row.hits).toBe('2');
    expect(row.dmgShield).toBe('15.50');
    expect(row.dmgSeg).toBe('0.00');
    expect(row.dmgCenter).toBe('5.50');
    expect(row.coreHitRate).toBe('0.5000');
    expect(row.coreDmgPerShot).toBe('2.75');
    expect(Number(row.coreHitRate)).toBeLessThanOrEqual(1);
    det();
  });

  it('keeps fractional core totals in the match snapshot', () => {
    (sim as any).winner = SIDE.LEFT;
    (sim as any).winnerAt = 2_000;
    recordMatchEnd();
    const row = csvRow(buildCSVs()['matches.csv'], '1,');
    expect(row.leftSegHP).toBe('3.5');
    expect(row.leftCenterHP).toBe('4.5');
    expect(row.leftShieldHP).toBe('0.25');
  });

  it('preserves fractional laser damage that depletes the center', () => {
    (sim as any).coreR = {
      center: { x: 540, y: 100 },
      segHP: new Array(8).fill(100),
      centerHP: 10.6,
    };
    fireLaser(SIDE.LEFT, { x: 0, y: 0 }, { x: 540, y: 100, _forceCenter: true } as any);
    expect((sim as any).coreR.centerHP).toBe(0);
    const row = csvRow(buildCSVs()['weapon_agg.csv'], 'L,laser,');
    expect(row.shots).toBe('1');
    expect(row.hits).toBe('1');
    expect(row.dmgCenter).toBe('10.60');
    expect(row.coreHitRate).toBe('1.0000');
    expect(Number(row.coreDmgPerShot)).toBeGreaterThan(1);
  });

  it('counts buff and debuff bin cycles and their durations', () => {
    runTriggers(1_500);
    const files = buildCSVs()['bin_cycles.csv'];
    const buff = csvRow(files, 'L,buff,');
    const debuff = csvRow(files, 'L,debuff,');
    expect(buff.cycles).toBe('1');
    expect(buff.avgMs).toBe('500.0');
    expect(debuff.cycles).toBe('1');
    expect(debuff.avgMs).toBe('500.0');
    expect((sim as any).binsL.buff.fill).toBe(0);
    expect((sim as any).binsL.debuff.fill).toBe(0);
  });
});
