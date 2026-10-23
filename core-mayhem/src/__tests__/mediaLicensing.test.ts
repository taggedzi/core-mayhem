import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { POOLS, RECORDED_ANNOUNCER_AVAILABLE } from '../announcer/config';
import voiceManifest from '../audio/announcer/manifest.json';
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

describe('original synthesized announcements', () => {
  it('provides 49 bundled lines covering every announcement pool', () => {
    expect(RECORDED_ANNOUNCER_AVAILABLE).toBe(true);
    expect(voiceManifest.clips).toHaveLength(49);
    expect(Object.values(POOLS).every((pool) => pool.length > 0)).toBe(true);
    expect(new Set(Object.values(POOLS).flat()).size).toBe(49);
    for (const url of Object.values(POOLS).flat()) {
      expect(url).toMatch(/\/audio\/announcer\/[^/]+\.wav/);
    }
  });

  it('records real PCM durations for overlap prevention', () => {
    for (const clip of voiceManifest.clips) {
      const wav = readFileSync(resolve(`src/audio/announcer/${clip.id}.wav`));
      expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
      expect(wav.readUInt32LE(40)).toBe(wav.length - 44);
      const duration = Math.ceil(((wav.length - 44) / wav.readUInt32LE(28)) * 1000);
      expect(clip.durationMs).toBe(duration);
      expect(duration).toBeGreaterThan(200);
      expect(duration).toBeLessThan(3000);
    }
  });
});
