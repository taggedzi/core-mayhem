import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { announcer, announcerControls } from '../announcer';
import { POOLS, RECORDED_ANNOUNCER_AVAILABLE } from '../announcer/config';
import { audio } from '../audio';
import { SOUNDS } from '../audio/config';

describe('original synthesized effects', () => {
  it('uses generated WAV files for every sound event', () => {
    expect(Object.keys(SOUNDS)).toHaveLength(15);
    for (const sound of Object.values(SOUNDS)) {
      expect(sound.src).toMatch(/\/audio\/(generated\/[^/]+|generated-low-health-alarm)\.wav/);
    }
  });

  it('ships 14 distinct, non-silent PCM effects with headroom and faded boundaries', () => {
    const directory = resolve('src/audio/generated');
    const files = readdirSync(directory).filter((name) => name.endsWith('.wav'));
    expect(files).toHaveLength(14);
    const hashes = new Set<string>();
    for (const file of files) {
      const wav = readFileSync(join(directory, file));
      expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
      expect(wav.toString('ascii', 8, 16)).toBe('WAVEfmt ');
      expect(wav.readUInt16LE(20)).toBe(1); // PCM
      expect(wav.readUInt16LE(22)).toBe(1); // mono
      expect(wav.readUInt32LE(24)).toBe(44100);
      expect(wav.readUInt16LE(34)).toBe(16);
      expect(wav.readUInt32LE(40)).toBe(wav.length - 44);
      expect(wav.readInt16LE(44)).toBe(0);
      expect(wav.readInt16LE(wav.length - 2)).toBe(0);
      let peak = 0;
      let energy = 0;
      for (let offset = 44; offset < wav.length; offset += 2) {
        const sample = wav.readInt16LE(offset);
        peak = Math.max(peak, Math.abs(sample));
        energy += sample * sample;
      }
      expect(peak).toBeLessThanOrEqual(22937);
      expect(Math.sqrt(energy / ((wav.length - 44) / 2)) / 32767).toBeGreaterThan(0.015);
      hashes.add(createHash('sha256').update(wav).digest('hex'));
    }
    expect(hashes.size).toBe(14);
  });
});

describe('excluded recorded announcements', () => {
  it('has no recorded URLs in any event pool', () => {
    expect(RECORDED_ANNOUNCER_AVAILABLE).toBe(false);
    expect(Object.values(POOLS).every((pool) => pool.length === 0)).toBe(true);
  });

  it('cannot be re-enabled through persisted audio settings', () => {
    const play = vi.spyOn(audio, 'playUrl');
    announcerControls.setEnabled(true);
    announcer.trigger('match_start_go', 10000);
    announcer.run(10000);
    expect(play).not.toHaveBeenCalled();
  });
});
