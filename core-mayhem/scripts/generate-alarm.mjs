// Original synthesized warning tone; covered by the repository MIT license.
import { writeFileSync } from 'node:fs';

const sampleRate = 22050;
const sampleCount = sampleRate;
const wav = Buffer.alloc(44 + sampleCount * 2);
wav.write('RIFF', 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(sampleCount * 2, 40);

// Two short alternating beeps with fades and silence at the loop boundary.
for (let i = 0; i < sampleCount; i++) {
  const time = i / sampleRate;
  const pulseTime = time % 0.5;
  const envelope = Math.max(0, Math.min(1, pulseTime / 0.01, (0.2 - pulseTime) / 0.02));
  const frequency = time < 0.5 ? 660 : 880;
  const value = 0.3 * envelope * Math.sin(2 * Math.PI * frequency * time);
  wav.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
}

writeFileSync(new URL('../src/audio/generated-low-health-alarm.wav', import.meta.url), wav);
