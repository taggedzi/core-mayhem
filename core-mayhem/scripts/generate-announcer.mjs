// Original scripts rendered with eSpeak NG's formant voice, not sampled speech.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const lines = JSON.parse(readFileSync(new URL('./announcer-lines.json', import.meta.url), 'utf8'));
const directory = new URL('../src/audio/announcer/', import.meta.url);
const engine = process.env.ESPEAK_NG_PATH || 'espeak-ng';
const version = execFileSync(engine, ['--version'], { encoding: 'utf8' })
  .split(/\r?\n/)[0]
  .split('  Data at:')[0];
const options = ['-v', 'en-us+m3', '-s', '185', '-p', '30', '-a', '150'];
mkdirSync(directory, { recursive: true });

const clips = [];
for (const line of lines) {
  const input = execFileSync(engine, [...options, '--stdout', line.text], {
    maxBuffer: 5 * 1024 * 1024,
  });
  if (input.toString('ascii', 0, 4) !== 'RIFF') throw new Error('Expected WAV output');
  let sampleRate;
  let data;
  for (let offset = 12; offset + 8 <= input.length; ) {
    const tag = input.toString('ascii', offset, offset + 4);
    const size = input.readUInt32LE(offset + 4);
    if (tag === 'fmt ') {
      if (
        input.readUInt16LE(offset + 8) !== 1 ||
        input.readUInt16LE(offset + 10) !== 1 ||
        input.readUInt16LE(offset + 22) !== 16
      )
        throw new Error('Expected mono PCM16');
      sampleRate = input.readUInt32LE(offset + 12);
    }
    if (tag === 'data') {
      // eSpeak stdout uses an estimated data size: limit it to actual bytes.
      data = input.subarray(offset + 8, Math.min(input.length, offset + 8 + size));
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (!data || !sampleRate) throw new Error('Incomplete speech WAV');
  const samples = new Float64Array(Math.floor(data.length / 2));
  let previous = 0;
  let high = 0;
  let low = 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = data.readInt16LE(i * 2) / 32768;
    high = 0.975 * (high + value - previous);
    previous = value;
    low += 0.7 * (high - low);
    samples[i] = Math.tanh(low * 1.4);
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (peak < 0.01) throw new Error(`Silent speech: ${line.id}`);
  let start = 0;
  let end = samples.length - 1;
  while (start < end && Math.abs(samples[start]) < peak * 0.01) start++;
  while (end > start && Math.abs(samples[end]) < peak * 0.01) end--;
  start = Math.max(0, start - Math.round(sampleRate * 0.02));
  end = Math.min(samples.length, end + Math.round(sampleRate * 0.08));
  const length = end - start;
  const output = Buffer.alloc(44 + length * 2);
  output.write('RIFF', 0);
  output.writeUInt32LE(output.length - 8, 4);
  output.write('WAVEfmt ', 8);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36);
  output.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) {
    const fade = Math.min(1, i / (sampleRate * 0.003), (length - 1 - i) / (sampleRate * 0.008));
    output.writeInt16LE(Math.round((samples[start + i] / peak) * 0.78 * 32767 * fade), 44 + i * 2);
  }
  writeFileSync(new URL(`${line.id}.wav`, directory), output);
  clips.push({ ...line, durationMs: Math.ceil((length / sampleRate) * 1000) });
}
writeFileSync(
  new URL('manifest.json', directory),
  JSON.stringify({ engine: version, options, clips }, null, 2) + '\n',
);
