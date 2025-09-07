// Centralized stats collection and CSV export
import { sim } from '../state';
import type { Side, WeaponKind } from '../types';

type SideKey = 'L' | 'R';
const sideKey = (s: Side): SideKey => (s < 0 ? 'L' : 'R');

type BinId = 'cannon' | 'laser' | 'missile' | 'mortar' | 'shield' | 'repair' | 'buff' | 'debuff';
const ALL_BINS: readonly BinId[] = [
  'cannon',
  'laser',
  'missile',
  'mortar',
  'shield',
  'repair',
  'buff',
  'debuff',
] as const;

const ALL_WEAPONS: readonly WeaponKind[] = ['cannon', 'laser', 'missile', 'mortar'] as const;

interface WeaponAgg {
  shots: number;
  hits: number;
  misses: number;
  dmgShield: number;
  dmgSeg: number;
  dmgCenter: number;
}

interface BinAggCycle {
  cycles: number;
  totalDurationMs: number;
  minMs: number;
  maxMs: number;
  totalDeposits: number;
  totalAmount: number;
}

interface MatchSummary {
  matchId: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  winner: Side | 0 | null;
  leftSegHP: number;
  leftCenterHP: number;
  leftShieldHP: number;
  rightSegHP: number;
  rightCenterHP: number;
  rightShieldHP: number;
}

interface FirstHitTimes {
  L: Partial<Record<WeaponKind, number>>;
  R: Partial<Record<WeaponKind, number>>;
}

interface TimelineBucket {
  matchId: number;
  tSec: number; // seconds since match start
  side: SideKey;
  weapon: WeaponKind;
  dmgShield: number;
  dmgSeg: number;
  dmgCenter: number;
}

interface SessionStats {
  version: 1;
  sessionId: number;
  createdAt: number;
  // Aggregates across the session
  weapon: { L: Record<WeaponKind, WeaponAgg>; R: Record<WeaponKind, WeaponAgg> };
  bins: { L: Record<BinId, BinAggCycle>; R: Record<BinId, BinAggCycle> };
  matches: MatchSummary[];
  damageTimeline: TimelineBucket[]; // per-match time series (1s buckets)
  firstHits: { matchId: number; side: SideKey; weapon: WeaponKind; ms: number }[];
  buffCounts: { L: Record<string, number>; R: Record<string, number> };
  debuffCounts: { L: Record<string, number>; R: Record<string, number> };
  // Running counters
  nextMatchId: number;
  // Per-match mod counts (flattened)
  modsPerMatch: { matchId: number; type: 'buff' | 'debuff'; side: SideKey; kind: string; count: number }[];
  // Diagnostics: per-missile first impact kind and time-to-first-core-hit
  missileFirstImpacts: { matchId: number; side: SideKey; kind: string }[];
  missileCoreDelays: { matchId: number; side: SideKey; ms: number }[];
}

interface InMatchState {
  matchId: number;
  startT: number;
  // per-bin cycle starts + per-cycle deposit tallies
  cycleStart: { L: Partial<Record<BinId, number>>; R: Partial<Record<BinId, number>> };
  cycleDeposits: { L: Partial<Record<BinId, number>>; R: Partial<Record<BinId, number>> };
  cycleAmount: { L: Partial<Record<BinId, number>>; R: Partial<Record<BinId, number>> };
  firstHitMs: FirstHitTimes;
  // per-second timeline accumulation (flushed on match end)
  timeline: Map<string, TimelineBucket>; // key `${matchId}|${tSec}|${side}|${weapon}`
  // per-match mod counts
  buffCounts: { L: Record<string, number>; R: Record<string, number> };
  debuffCounts: { L: Record<string, number>; R: Record<string, number> };
}

let session: SessionStats | null = null;
let inMatch: InMatchState | null = null;

const LS_KEY = 'coreMayhem.stats.v1';
let savePending = false;
function scheduleSave(): void {
  if (savePending) return;
  savePending = true;
  setTimeout(() => {
    savePending = false;
    try {
      if (session) localStorage.setItem(LS_KEY, JSON.stringify(session));
    } catch {
      /* ignore */
    }
  }, 500);
}

function emptyWeaponAgg(): WeaponAgg {
  return { shots: 0, hits: 0, misses: 0, dmgShield: 0, dmgSeg: 0, dmgCenter: 0 };
}
function emptyBinAgg(): BinAggCycle {
  return { cycles: 0, totalDurationMs: 0, minMs: Number.POSITIVE_INFINITY, maxMs: 0, totalDeposits: 0, totalAmount: 0 };
}

function ensureSessionShape(s: any): SessionStats {
  s = s || {};
  s.version = 1;
  s.sessionId = s.sessionId ?? (Date.now() | 0);
  s.createdAt = s.createdAt ?? performance.now();
  // weapons
  s.weapon = s.weapon ?? { L: {}, R: {} };
  for (const sk of ['L', 'R'] as const) {
    s.weapon[sk] = s.weapon[sk] ?? {};
    for (const w of ALL_WEAPONS) {
      const a = s.weapon[sk][w] ?? {};
      s.weapon[sk][w] = {
        shots: a.shots ?? 0,
        hits: a.hits ?? 0,
        misses: a.misses ?? 0,
        dmgShield: a.dmgShield ?? 0,
        dmgSeg: a.dmgSeg ?? 0,
        dmgCenter: a.dmgCenter ?? 0,
      };
    }
  }
  // bins
  s.bins = s.bins ?? { L: {}, R: {} };
  for (const sk of ['L', 'R'] as const) {
    s.bins[sk] = s.bins[sk] ?? {};
    for (const b of ALL_BINS) {
      const cur = s.bins[sk][b] ?? {};
      s.bins[sk][b] = {
        cycles: cur.cycles ?? 0,
        totalDurationMs: cur.totalDurationMs ?? 0,
        minMs: cur.minMs ?? Number.POSITIVE_INFINITY,
        maxMs: cur.maxMs ?? 0,
        totalDeposits: cur.totalDeposits ?? 0,
        totalAmount: cur.totalAmount ?? 0,
      };
    }
  }
  s.matches = Array.isArray(s.matches) ? s.matches : [];
  s.damageTimeline = Array.isArray(s.damageTimeline) ? s.damageTimeline : [];
  s.firstHits = Array.isArray(s.firstHits) ? s.firstHits : [];
  s.buffCounts = s.buffCounts ?? { L: {}, R: {} };
  s.buffCounts.L = s.buffCounts.L ?? {};
  s.buffCounts.R = s.buffCounts.R ?? {};
  s.debuffCounts = s.debuffCounts ?? { L: {}, R: {} };
  s.debuffCounts.L = s.debuffCounts.L ?? {};
  s.debuffCounts.R = s.debuffCounts.R ?? {};
  s.nextMatchId = s.nextMatchId ?? 1;
  s.modsPerMatch = Array.isArray(s.modsPerMatch) ? s.modsPerMatch : [];
  s.missileFirstImpacts = Array.isArray(s.missileFirstImpacts) ? s.missileFirstImpacts : [];
  s.missileCoreDelays = Array.isArray(s.missileCoreDelays) ? s.missileCoreDelays : [];
  return s as SessionStats;
}

export function initStats(): void {
  if (session) return;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      session = ensureSessionShape(parsed);
    }
  } catch {
    /* ignore */
  }
  if (!session) {
    session = ensureSessionShape({});
    scheduleSave();
  }
}

export function startNewMatch(): void {
  initStats();
  if (!session) return;
  const id = session.nextMatchId++;
  const startT = (sim as any).matchStart ?? performance.now();
  inMatch = {
    matchId: id,
    startT,
    cycleStart: { L: {}, R: {} },
    cycleDeposits: { L: {}, R: {} },
    cycleAmount: { L: {}, R: {} },
    firstHitMs: { L: {}, R: {} },
    timeline: new Map(),
    buffCounts: { L: {}, R: {} },
    debuffCounts: { L: {}, R: {} },
  };
  // Initialize bin cycle starts at match start
  for (const side of ['L', 'R'] as const) {
    for (const b of ALL_BINS) (inMatch.cycleStart[side][b] as number | undefined) = startT;
  }
  scheduleSave();
}

function ensure(): asserts session is SessionStats {
  if (!session) throw new Error('stats not initialized');
}

// --- Recording helpers ---
export function recordShotFired(side: Side, weapon: WeaponKind): void {
  ensure();
  const sk = sideKey(side);
  session!.weapon[sk][weapon].shots++;
}

function bumpHit(side: Side, weapon: WeaponKind, dmgShield: number, dmgSeg: number, dmgCenter: number, now = performance.now()): void {
  ensure();
  const sk = sideKey(side);
  const a = session!.weapon[sk][weapon];
  a.hits++;
  a.dmgShield += Math.max(0, dmgShield);
  a.dmgSeg += Math.max(0, dmgSeg);
  a.dmgCenter += Math.max(0, dmgCenter);

  // First-hit timing (ms since match start)
  if (inMatch) {
    const tRel = Math.max(0, Math.round(now - inMatch.startT));
    if (inMatch.firstHitMs[sk][weapon] == null) inMatch.firstHitMs[sk][weapon] = tRel;

    // Damage timeline bucket by second
    const tSec = Math.floor(tRel / 1000);
    const key = `${inMatch.matchId}|${tSec}|${sk}|${weapon}`;
    const prev = inMatch.timeline.get(key);
    if (prev) {
      prev.dmgShield += Math.max(0, dmgShield);
      prev.dmgSeg += Math.max(0, dmgSeg);
      prev.dmgCenter += Math.max(0, dmgCenter);
    } else {
      inMatch.timeline.set(key, {
        matchId: inMatch.matchId,
        tSec,
        side: sk,
        weapon,
        dmgShield: Math.max(0, dmgShield),
        dmgSeg: Math.max(0, dmgSeg),
        dmgCenter: Math.max(0, dmgCenter),
      });
    }
  }
}

export function recordProjectileHit(side: Side, weapon: WeaponKind, dmgShield: number, dmgSeg: number, dmgCenter: number, now = performance.now()): void {
  bumpHit(side, weapon, dmgShield, dmgSeg, dmgCenter, now);
}

export function recordLaserHit(side: Side, dmgShield: number, dmgSeg: number, dmgCenter: number, now = performance.now()): void {
  bumpHit(side, 'laser', dmgShield, dmgSeg, dmgCenter, now);
}

export function recordMiss(side: Side, weapon: WeaponKind): void {
  ensure();
  const sk = sideKey(side);
  session!.weapon[sk][weapon].misses++;
}

// --- Diagnostics ---
export function recordMissileFirstImpact(side: Side, kind: string): void {
  ensure();
  if (!inMatch) return;
  session!.missileFirstImpacts.push({ matchId: inMatch.matchId, side: sideKey(side), kind });
  scheduleSave();
}

export function recordMissileCoreDelay(side: Side, ms: number): void {
  ensure();
  if (!inMatch) return;
  session!.missileCoreDelays.push({ matchId: inMatch.matchId, side: sideKey(side), ms: Math.max(0, ms | 0) });
  scheduleSave();
}

export function recordBinDeposit(side: Side, bin: BinId, amount: number, now = performance.now()): void {
  ensure();
  const sk = sideKey(side);
  const agg = session!.bins[sk][bin];
  agg.totalDeposits++;
  agg.totalAmount += Math.max(0, amount | 0);
  if (inMatch) {
    inMatch.cycleDeposits[sk][bin] = (inMatch.cycleDeposits[sk][bin] || 0) + 1;
    inMatch.cycleAmount[sk][bin] = (inMatch.cycleAmount[sk][bin] || 0) + Math.max(0, amount | 0);
  }
}

export function recordBinCap(side: Side, bin: BinId, now = performance.now()): void {
  ensure();
  if (!inMatch) return;
  const sk = sideKey(side);
  const start = inMatch.cycleStart[sk][bin] ?? inMatch.startT;
  const dur = Math.max(0, now - start);
  const agg = session!.bins[sk][bin];
  agg.cycles++;
  agg.totalDurationMs += dur;
  agg.minMs = Math.min(agg.minMs, dur);
  agg.maxMs = Math.max(agg.maxMs, dur);
  // Start next cycle now
  inMatch.cycleStart[sk][bin] = now;
  inMatch.cycleDeposits[sk][bin] = 0;
  inMatch.cycleAmount[sk][bin] = 0;
}

export function recordMatchEnd(): void {
  ensure();
  if (!inMatch) return;
  const matchId = inMatch.matchId;
  const startedAt = inMatch.startT;
  const endedAt = (sim as any).winnerAt ?? performance.now();
  const durationMs = Math.max(0, endedAt - startedAt);
  const winner = (sim as any).winner ?? null;

  const coreL = (sim as any).coreL;
  const coreR = (sim as any).coreR;
  const sumSeg = (arr: number[] | null | undefined) => (Array.isArray(arr) ? arr.reduce((a, b) => a + (b | 0), 0) : 0);
  const leftSegHP = sumSeg(coreL?.segHP);
  const leftCenterHP = coreL?.centerHP | 0;
  const leftShieldHP = coreL?.shieldHP | 0;
  const rightSegHP = sumSeg(coreR?.segHP);
  const rightCenterHP = coreR?.centerHP | 0;
  const rightShieldHP = coreR?.shieldHP | 0;

  session!.matches.push({
    matchId,
    startedAt,
    endedAt,
    durationMs,
    winner,
    leftSegHP,
    leftCenterHP,
    leftShieldHP,
    rightSegHP,
    rightCenterHP,
    rightShieldHP,
  });

  // Flush timeline map to the session store
  for (const bucket of inMatch.timeline.values()) session!.damageTimeline.push(bucket);

  // Flush first-hit times per weapon and side
  for (const sk of ['L', 'R'] as const) {
    for (const w of ALL_WEAPONS) {
      const ms = inMatch.firstHitMs[sk][w];
      if (ms != null) session!.firstHits.push({ matchId, side: sk, weapon: w, ms });
    }
  }

  // Flush per-match mod counts
  for (const sk of ['L', 'R'] as const) {
    const b = inMatch.buffCounts[sk];
    for (const [k, v] of Object.entries(b)) session!.modsPerMatch.push({ matchId, type: 'buff', side: sk, kind: k, count: v });
  }
  for (const sk of ['L', 'R'] as const) {
    const d = inMatch.debuffCounts[sk];
    for (const [k, v] of Object.entries(d)) session!.modsPerMatch.push({ matchId, type: 'debuff', side: sk, kind: k, count: v });
  }

  // End the in-match state
  inMatch = null;
  scheduleSave();
}

// --- CSV Export ---
function toCsvRow(vals: (string | number)[]): string {
  return vals
    .map((v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    })
    .join(',');
}

export function buildCSVs(): Record<string, string> {
  ensure();
  const files: Record<string, string> = {};

  // weapon_agg.csv
  {
    const rows: string[] = [];
    rows.push(
      toCsvRow([
        'side',
        'weapon',
        'shots',
        'hits',
        'misses',
        'hitRate',
        'missPct',
        'dmgShield',
        'dmgSeg',
        'dmgCenter',
        'coreHitRate',
        'coreDmgPerShot',
      ]),
    );
    for (const sk of ['L', 'R'] as const) {
      for (const w of ALL_WEAPONS) {
        const a = session!.weapon[sk][w];
        const shots = a.shots || 0;
        const hits = a.hits || 0;
        const misses = a.misses || 0;
        const hitRate = shots ? hits / shots : 0;
        const missPct = shots ? misses / shots : 0;
        const coreDmg = a.dmgSeg + a.dmgCenter;
        const coreHitRate = shots ? coreDmg / shots : 0;
        const coreDmgPerShot = shots ? coreDmg / shots : 0;
        rows.push(
          toCsvRow([
            sk,
            w,
            shots,
            hits,
            misses,
            hitRate.toFixed(4),
            (missPct * 100).toFixed(2),
            a.dmgShield.toFixed(2),
            a.dmgSeg.toFixed(2),
            a.dmgCenter.toFixed(2),
            coreHitRate.toFixed(4),
            coreDmgPerShot.toFixed(2),
          ]),
        );
      }
    }
    files['weapon_agg.csv'] = rows.join('\n');
  }

  // bin_cycles.csv
  {
    const rows: string[] = [];
    rows.push(toCsvRow(['side', 'bin', 'cycles', 'avgMs', 'minMs', 'maxMs', 'totalDeposits', 'totalAmount']));
    for (const sk of ['L', 'R'] as const) {
      for (const b of ALL_BINS) {
        const a = session!.bins[sk][b];
        const avg = a.cycles ? a.totalDurationMs / a.cycles : 0;
        const minMs = Number.isFinite(a.minMs) ? a.minMs : 0;
        rows.push(
          toCsvRow([
            sk,
            b,
            a.cycles | 0,
            avg.toFixed(1),
            minMs.toFixed(1),
            a.maxMs.toFixed(1),
            a.totalDeposits | 0,
            a.totalAmount | 0,
          ]),
        );
      }
    }
    files['bin_cycles.csv'] = rows.join('\n');
  }

  // matches.csv
  {
    const rows: string[] = [];
    rows.push(
      toCsvRow([
        'matchId',
        'startedAt',
        'endedAt',
        'durationMs',
        'winner',
        'leftSegHP',
        'leftCenterHP',
        'leftShieldHP',
        'rightSegHP',
        'rightCenterHP',
        'rightShieldHP',
      ]),
    );
    for (const m of session!.matches) {
      rows.push(
        toCsvRow([
          m.matchId,
          Math.round(m.startedAt),
          Math.round(m.endedAt),
          Math.round(m.durationMs),
          m.winner ?? '',
          m.leftSegHP,
          m.leftCenterHP,
          m.leftShieldHP,
          m.rightSegHP,
          m.rightCenterHP,
          m.rightShieldHP,
        ]),
      );
    }
    files['matches.csv'] = rows.join('\n');
  }

  // damage_timeline.csv (per second per weapon)
  {
    const rows: string[] = [];
    rows.push(toCsvRow(['matchId', 'tSec', 'side', 'weapon', 'dmgShield', 'dmgSeg', 'dmgCenter']));
    const dmgTL = Array.isArray(session!.damageTimeline) ? session!.damageTimeline : [];
    for (const b of dmgTL) {
      rows.push(
        toCsvRow([
          b.matchId,
          b.tSec,
          b.side,
          b.weapon,
          b.dmgShield.toFixed(2),
          b.dmgSeg.toFixed(2),
          b.dmgCenter.toFixed(2),
        ]),
      );
    }
    files['damage_timeline.csv'] = rows.join('\n');
  }

  // first_hits.csv (per match, per side/weapon)
  {
    const rows: string[] = [];
    rows.push(toCsvRow(['matchId', 'side', 'weapon', 'msToFirstHit']));
    const __first = Array.isArray(session!.firstHits) ? session!.firstHits : [];
    for (const fh of __first) {
      rows.push(toCsvRow([fh.matchId, fh.side, fh.weapon, fh.ms]));
    }
    files['first_hits.csv'] = rows.join('\n');
  }

  // mods_agg.csv (buffs/debuffs counts by side)
  {
    const rows: string[] = [];
    rows.push(toCsvRow(['type', 'side', 'kind', 'count']));
    for (const sk of ['L', 'R'] as const) {
      const b = (session!.buffCounts && session!.buffCounts[sk]) ? session!.buffCounts[sk] : {};
      for (const [k, v] of Object.entries(b)) rows.push(toCsvRow(['buff', sk, k, v]));
    }
    for (const sk of ['L', 'R'] as const) {
      const d = (session!.debuffCounts && session!.debuffCounts[sk]) ? session!.debuffCounts[sk] : {};
      for (const [k, v] of Object.entries(d)) rows.push(toCsvRow(['debuff', sk, k, v]));
    }
    files['mods_agg.csv'] = rows.join('\n');
  }

  // mods_per_match.csv (counts per match, side, and kind)
  {
    const rows: string[] = [];
    rows.push(toCsvRow(['matchId', 'type', 'side', 'kind', 'count']));
    const mpm = Array.isArray(session!.modsPerMatch) ? session!.modsPerMatch : [];
    for (const r of mpm) rows.push(toCsvRow([r.matchId, r.type, r.side, r.kind, r.count]));
    files['mods_per_match.csv'] = rows.join('\n');
  }

  // missile_first_impacts.csv (per missile: first impacted collider kind)
  {
    const rows: string[] = [];
    rows.push(toCsvRow(['matchId', 'side', 'kind']));
    const arr = Array.isArray((session as any).missileFirstImpacts)
      ? ((session as any).missileFirstImpacts as { matchId: number; side: 'L' | 'R'; kind: string }[])
      : [];
    for (const r of arr) rows.push(toCsvRow([r.matchId, r.side, r.kind]));
    files['missile_first_impacts.csv'] = rows.join('\n');
  }

  // missile_core_delays.csv (per missile that damaged core: ms from spawn to first core damage)
  {
    const rows: string[] = [];
    rows.push(toCsvRow(['matchId', 'side', 'msToCoreHit']));
    const arr = Array.isArray((session as any).missileCoreDelays)
      ? ((session as any).missileCoreDelays as { matchId: number; side: 'L' | 'R'; ms: number }[])
      : [];
    for (const r of arr) rows.push(toCsvRow([r.matchId, r.side, r.ms]));
    files['missile_core_delays.csv'] = rows.join('\n');
  }

  return files;
}

function download(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportAllCSVs(): void {
  ensure();
  const files = buildCSVs();
  const prefix = `core-mayhem-session-${session!.sessionId}-`;
  for (const [name, data] of Object.entries(files)) download(prefix + name, data);
}

export function resetStats(): void {
  // Clear localStorage and start a fresh session
  try { localStorage.removeItem(LS_KEY); } catch {}
  session = null;
  inMatch = null;
  initStats();
}

export function recordBuff(side: Side, kind: string): void {
  ensure();
  const sk = sideKey(side);
  const bucket = session!.buffCounts[sk];
  bucket[kind] = (bucket[kind] ?? 0) + 1;
  if (inMatch) {
    const mb = inMatch.buffCounts[sk];
    mb[kind] = (mb[kind] ?? 0) + 1;
  }
  scheduleSave();
}

export function recordDebuff(targetSide: Side, kind: WeaponKind | null): void {
  ensure();
  const sk = sideKey(targetSide);
  const name = kind ?? 'none';
  const bucket = session!.debuffCounts[sk];
  bucket[name] = (bucket[name] ?? 0) + 1;
  if (inMatch) {
    const md = inMatch.debuffCounts[sk];
    md[name] = (md[name] ?? 0) + 1;
  }
  scheduleSave();
}

// Lightweight summary for UI
export function getSummary(): {
  matches: number;
  leftWins: number;
  rightWins: number;
  ties: number;
  buffsL: number;
  buffsR: number;
  debuffsL: number;
  debuffsR: number;
} {
  ensure();
  const matches = Array.isArray(session!.matches) ? session!.matches.length : 0;
  let leftWins = 0, rightWins = 0, ties = 0;
  if (Array.isArray(session!.matches)) {
    for (const m of session!.matches) {
      if (m.winner === -1) leftWins++;
      else if (m.winner === 1) rightWins++;
      else ties++;
    }
  }
  const sumVals = (o: Record<string, number> | undefined) => o ? Object.values(o).reduce((a, b) => a + (b | 0), 0) : 0;
  const buffsL = sumVals(session!.buffCounts?.L);
  const buffsR = sumVals(session!.buffCounts?.R);
  const debuffsL = sumVals(session!.debuffCounts?.L);
  const debuffsR = sumVals(session!.debuffCounts?.R);
  return { matches, leftWins, rightWins, ties, buffsL, buffsR, debuffsL, debuffsR };
}
