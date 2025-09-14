
// Import asset URLs via bundler; these are resolved to URLs at build time
// Note: some filenames contain typos; we match the actual files on disk.
import activate_buff_url from '../assets/audio/activate_buff.ogg';
import activate_debuff_url from '../assets/audio/activate_debuff.ogg';
import core_alarm_url from '../assets/audio/core_alarm.ogg';
import core_death_url from '../assets/audio/core_death.ogg';
import core_repair_url from '../assets/audio/core_repair.ogg';
import core_shield_down_url from '../assets/audio/core_sheilf_down.ogg';
import core_shield_up_url from '../assets/audio/core_sheilf_up.ogg';
import fire_cannon_url from '../assets/audio/fire_cannon.ogg';
import fire_laser_url from '../assets/audio/fire_laser.ogg';
import fire_missile_url from '../assets/audio/fire_missile.ogg';
import fire_mortar_url from '../assets/audio/fire_mortar.ogg';
import impact_armor_url from '../assets/audio/impact_armor.ogg';
import impact_core_url from '../assets/audio/impact_core.ogg';
import impact_miss_url from '../assets/audio/impact_miss.ogg';
import impact_shield_url from '../assets/audio/impact_sheild.ogg';

import type { SoundKey } from './keys';

export interface SoundSpec {
  src: string; // URL resolved by bundler
  channel?: 'sfx' | 'music';
  volume?: number; // 0..1 default volume
  rate?: number; // playbackRate (pitch-ish)
  detune?: number; // cents
  loop?: boolean; // for alarms/music
  cooldownMs?: number; // min ms between plays to avoid spam
  maxConcurrent?: number; // cap overlapping instances
  duckMusic?: number; // if set, temporarily reduce music gain by this factor (0..1)
}

export type SoundConfig = Record<SoundKey, SoundSpec>;

export const SOUNDS: SoundConfig = {
  fire_cannon: { src: fire_cannon_url, volume: 0.6, cooldownMs: 40, maxConcurrent: 6 },
  fire_laser: { src: fire_laser_url, volume: 0.5, cooldownMs: 120, maxConcurrent: 2 },
  fire_missile: { src: fire_missile_url, volume: 0.7, cooldownMs: 180, maxConcurrent: 3 },
  fire_mortar: { src: fire_mortar_url, volume: 0.7, cooldownMs: 200, maxConcurrent: 2 },

  impact_shield: { src: impact_shield_url, volume: 0.7, cooldownMs: 40, maxConcurrent: 8, duckMusic: 0.6 },
  impact_armor: { src: impact_armor_url, volume: 0.6, cooldownMs: 40, maxConcurrent: 8, duckMusic: 0.6 },
  impact_core: { src: impact_core_url, volume: 0.8, cooldownMs: 60, maxConcurrent: 6, duckMusic: 0.5 },
  impact_miss: { src: impact_miss_url, volume: 0.45, cooldownMs: 80, maxConcurrent: 4 },

  activate_buff: { src: activate_buff_url, volume: 0.7, cooldownMs: 500 },
  activate_debuff: { src: activate_debuff_url, volume: 0.7, cooldownMs: 500 },

  core_death: { src: core_death_url, volume: 1.0, cooldownMs: 1000, duckMusic: 0.3 },
  core_low_hp_alarm: { src: core_alarm_url, volume: 0.4, loop: true },
  core_shield_up: { src: core_shield_up_url, volume: 0.7, cooldownMs: 300 },
  core_shield_down: { src: core_shield_down_url, volume: 0.8, cooldownMs: 300, duckMusic: 0.6 },
  armor_increase: { src: core_repair_url, volume: 0.7, cooldownMs: 300 },
};

// Global-level audio defaults/toggles
export const AUDIO_DEFAULTS = {
  enabled: true,
  masterVolume: 0.9,
  sfxVolume: 1.0,
  musicVolume: 0.6,
  announcerVolume: 0.9,
  duckReleaseMs: 600, // recovery time back to full music volume
  lowHPThresholdPct: 0.15, // alarm threshold of center HP
} as const;
