import manifest from '../audio/announcer/manifest.json';

// Bundled, offline formant-synthesized speech; no runtime synthesis service.

export type AnnounceEvent =
  | 'pre_game'
  | 'match_start_ready'
  | 'match_start_go'
  | 'first_core_damage'
  | 'high_damage'
  | 'major_swing'
  | 'extreme_event'
  | 'comeback_noticeable'
  | 'comeback_major'
  | 'comeback_epic'
  | 'core_in_danger_L'
  | 'core_in_danger_R'
  | 'momentum_shift'
  | 'time_countdown_10'
  | 'time_countdown_3'
  | 'match_end_win'
  | 'match_end_generic';

// Volumes and ducking during VO playback
export const ANNOUNCER_AUDIO = {
  announcerVolume: 0.9,
  duckMusic: 0.7,
  duckSfx: 0.6,
  duckReleaseMs: 600,
  minGapMs: 5000, // global min gap between VO lines
} as const;

// Detection thresholds and timings (tune to taste)
export const ANNOUNCER_THRESHOLDS = {
  lowHPpct: 0.15, // announce danger when core <= 15% center HP
  // Absolute per-tick swing thresholds (difference in damage between sides this tick)
  // Use your analyzed stats as defaults
  swingHigh: 42, // top ~25%
  swingMajor: 65, // top ~10%
  swingExtreme: 81, // rarest ~5%
  // Comeback thresholds (HP recovered from worst deficit so far)
  comebackNoticeable: 4000,
  comebackMajor: 4100,
  comebackEpic: 4200,
  // Legacy option if you want to also trigger on drop as fraction of center HP
  highDamagePctOfCenter: 0.12,
  momentumShiftPctOfCenter: 0.2, // advantage sign flip where post-flip magnitude >= 20%
  momentumWindowMs: 5000,
  countdownSecs: [10, 3] as const,
} as const;

const poolNames = {
  pre_game: [],
  ready: [],
  go: [],
  firstblood: [],
  danger: [],
  high_damage: [],
  momentum: [],
  extreme: [],
  comeback: [],
  match_end_win: [],
  match_end_generic: [],
  time_countdown_10: [],
  time_countdown_3: [],
} as const;

type PoolId = keyof typeof poolNames;
const urls = import.meta.glob('../audio/announcer/*.wav', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function clipsFor(pool: PoolId): readonly string[] {
  return manifest.clips.filter((clip) => clip.pools.includes(pool))
    .map((clip) => urls[`../audio/announcer/${clip.id}.wav`])
    .filter((url): url is string => typeof url === 'string');
}

export const POOLS = {
  pre_game: clipsFor('pre_game'),
  ready: clipsFor('ready'),
  go: clipsFor('go'),
  firstblood: clipsFor('firstblood'),
  danger: clipsFor('danger'),
  high_damage: clipsFor('high_damage'),
  momentum: clipsFor('momentum'),
  extreme: clipsFor('extreme'),
  comeback: clipsFor('comeback'),
  match_end_win: clipsFor('match_end_win'),
  match_end_generic: clipsFor('match_end_generic'),
  time_countdown_10: clipsFor('time_countdown_10'),
  time_countdown_3: clipsFor('time_countdown_3'),
};

export const CLIP_DURATION_MS = Object.fromEntries(manifest.clips.map((clip) => [
  urls[`../audio/announcer/${clip.id}.wav`], clip.durationMs,
]));

export const RECORDED_ANNOUNCER_AVAILABLE = manifest.clips.length === 49
  && manifest.clips.every((clip) => !!urls[`../audio/announcer/${clip.id}.wav`])
  && Object.keys(poolNames).every((pool) => POOLS[pool as PoolId].length > 0);

// Event mapping to pools with priorities and per-event cooldowns
export const EVENTS: Record<
  AnnounceEvent,
  { pools: readonly (keyof typeof POOLS)[]; priority: number; cooldownMs?: number }
> = {
  pre_game: { pools: ['pre_game'], priority: 3, cooldownMs: 6000 },
  match_start_ready: { pools: ['ready'], priority: 5, cooldownMs: 4000 },
  match_start_go: { pools: ['go'], priority: 6, cooldownMs: 4000 },
  first_core_damage: { pools: ['firstblood'], priority: 8, cooldownMs: 6000 },
  high_damage: { pools: ['high_damage'], priority: 6, cooldownMs: 6000 },
  major_swing: { pools: ['momentum', 'high_damage'], priority: 8, cooldownMs: 8000 },
  extreme_event: { pools: ['extreme'], priority: 9, cooldownMs: 12000 },
  comeback_noticeable: { pools: ['comeback', 'momentum'], priority: 7, cooldownMs: 15000 },
  comeback_major: { pools: ['comeback', 'momentum'], priority: 8, cooldownMs: 18000 },
  comeback_epic: { pools: ['extreme', 'comeback'], priority: 9, cooldownMs: 22000 },
  core_in_danger_L: { pools: ['danger'], priority: 9, cooldownMs: 10000 },
  core_in_danger_R: { pools: ['danger'], priority: 9, cooldownMs: 10000 },
  momentum_shift: { pools: ['momentum'], priority: 5, cooldownMs: 12000 },
  time_countdown_10: { pools: ['time_countdown_10'], priority: 7, cooldownMs: 15000 },
  time_countdown_3: { pools: ['time_countdown_3'], priority: 8, cooldownMs: 15000 },
  match_end_win: { pools: ['match_end_win'], priority: 10, cooldownMs: 8000 },
  match_end_generic: { pools: ['match_end_generic'], priority: 10, cooldownMs: 8000 },
} as const;
