/* eslint-disable import/order */
// Manual announcer pool grouping and detection thresholds
// Expand these lists as you add more files into src/assets/audio/announcer

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

// Pools: manual lists of files (imported as URLs by bundler)
// Keep names semantic so events can reference pools without changing file paths everywhere
import pre_battle_1 from '../assets/audio/announcer/battle_of_the_century.ogg';
import pre_battle_2 from '../assets/audio/announcer/who_will_win.ogg';
import pre_battle_3 from '../assets/audio/announcer/get_ready_for_the_next_fight.ogg';
import pre_battle_4 from '../assets/audio/announcer/may_the_best_fighter_win.ogg';

import ready_1 from '../assets/audio/announcer/ready_1.ogg';
import ready_2 from '../assets/audio/announcer/ready_2.ogg';
import ready_3 from '../assets/audio/announcer/get_ready.ogg';
import ready_4 from '../assets/audio/announcer/show_time.ogg';
import ready_5 from '../assets/audio/announcer/get_ready.ogg';

import fight_1 from '../assets/audio/announcer/fight_1.ogg';
import fight_2 from '../assets/audio/announcer/fight_2.ogg';
import fight_3 from '../assets/audio/announcer/fight_3.ogg';
import go_1 from '../assets/audio/announcer/go_1.ogg';
import go_2 from '../assets/audio/announcer/go_2.ogg';
import go_3 from '../assets/audio/announcer/go_3.ogg';
import lets_rock from '../assets/audio/announcer/lets_rock.ogg';

import firstblood_1 from '../assets/audio/announcer/firstblood_1.ogg';
import firstblood_2 from '../assets/audio/announcer/firstblood_2.ogg';

import danger_1 from '../assets/audio/announcer/danger_1.ogg';
import danger_2 from '../assets/audio/announcer/danger_2.ogg';
import danger_3 from '../assets/audio/announcer/danger_3.ogg';
import this_is_the_end_1 from '../assets/audio/announcer/this_is_the_end_1.ogg';
import this_is_the_end_2 from '../assets/audio/announcer/this_is_the_end_2.ogg';

import theyre_on_fire from '../assets/audio/announcer/theyre_on_fire.ogg';
import over_the_top from '../assets/audio/announcer/over_the_top.ogg';
import amazing from '../assets/audio/announcer/amazing.ogg';
import wow from '../assets/audio/announcer/wow.ogg';
import sick from '../assets/audio/announcer/sick.ogg';
import excellent_1 from '../assets/audio/announcer/excellent_1.ogg';
import excellent_2 from '../assets/audio/announcer/excellent_2.ogg';
import not_bad from '../assets/audio/announcer/not_bad.ogg';

import ivenever_seen from '../assets/audio/announcer/ive_never_seen_moves.ogg';
import this_should_be_good from '../assets/audio/announcer/this_should_be_good.ogg';
import battle_explode from '../assets/audio/announcer/battle_is_about_to_explode.ogg';
import its_all_on_the_line from '../assets/audio/announcer/its_all_on_the_line.ogg';
import go_for_broke from '../assets/audio/announcer/go_for_broke.ogg';

import you_win_1 from '../assets/audio/announcer/you_win_1.ogg';
import you_win_2 from '../assets/audio/announcer/you_win_2.ogg';
import winner_1 from '../assets/audio/announcer/winner_1.ogg';
import winner_2 from '../assets/audio/announcer/winner_2.ogg';
import winner_3 from '../assets/audio/announcer/winner_3.ogg';

import gameover_1 from '../assets/audio/announcer/gameover_1.ogg';
import gameover_2 from '../assets/audio/announcer/gameover_2.ogg';
import finish from '../assets/audio/announcer/finish.ogg';
import finished from '../assets/audio/announcer/finished.ogg';
import match_over from '../assets/audio/announcer/match_over.ogg';
import match_complete from '../assets/audio/announcer/match_complete.ogg';

import count10 from '../assets/audio/announcer/count_down_from_10.ogg';
import count3 from '../assets/audio/announcer/count_down_from_3.ogg';
import triumph_or_die from '../assets/audio/announcer/triumph_or_die.ogg';

export const POOLS = {
  pre_game: [pre_battle_1, pre_battle_2, pre_battle_3, pre_battle_4],
  ready: [ready_1, ready_2, ready_3, ready_4, ready_5],
  go: [fight_1, fight_2, fight_3, go_1, go_2, go_3, lets_rock],
  firstblood: [firstblood_1, firstblood_2],
  danger: [danger_1, danger_2, danger_3, this_is_the_end_1, this_is_the_end_2],
  high_damage: [
    theyre_on_fire,
    over_the_top,
    amazing,
    wow,
    sick,
    excellent_1,
    excellent_2,
    not_bad,
  ],
  momentum: [ivenever_seen, this_should_be_good, battle_explode, its_all_on_the_line],
  extreme: [triumph_or_die, battle_explode, its_all_on_the_line, over_the_top],
  comeback: [ivenever_seen, this_should_be_good, theyre_on_fire, amazing, wow, go_for_broke],
  match_end_win: [you_win_1, you_win_2, winner_1, winner_2, winner_3],
  match_end_generic: [gameover_1, gameover_2, finish, finished, match_over, match_complete],
  time_countdown_10: [count10],
  time_countdown_3: [count3],
} as const;

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
