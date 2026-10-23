// Original procedural combat sounds. MIT licensed; no input recordings or samples.
import { mkdirSync, writeFileSync } from 'node:fs';

const RATE = 44100;
const TAU = Math.PI * 2;
const destination = new URL('../src/audio/generated/', import.meta.url);
mkdirSync(destination, { recursive: true });

function render(duration, seed, layers) {
  const samples = new Float64Array(Math.ceil(duration * RATE));
  // A fixed seed makes every output reproducible across regenerations.
  let randomState = seed;
  const random = () => {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return (randomState >>> 0) / 2147483648 - 1;
  };

  for (const layer of layers) {
    const start = Math.round((layer.at ?? 0) * RATE);
    const length = Math.round(layer.duration * RATE);
    let phase = 0;
    let low = 0;
    const smoothing = 1 - Math.exp((-TAU * (layer.cutoff ?? 1800)) / RATE);
    for (let i = 0; i < length && start + i < samples.length; i++) {
      const t = i / RATE;
      const progress = i / length;
      const attack = Math.min(1, t / (layer.attack ?? 0.003));
      const release = Math.min(1, (length - 1 - i) / (RATE * 0.012));
      const envelope = attack * release * Math.exp(-(layer.decay ?? 4) * progress);
      let value;
      if (layer.noise) {
        const white = random();
        low += smoothing * (white - low);
        value = layer.highpass ? white - low : low;
      } else {
        const from = layer.from;
        const to = layer.to ?? from;
        const frequency = from * Math.pow(to / from, progress);
        phase += (TAU * frequency) / RATE;
        value = Math.sin(phase);
        if (layer.metal)
          value = (value + 0.45 * Math.sin(phase * 2.76) + 0.2 * Math.sin(phase * 4.13)) / 1.65;
        if (layer.fm) value = Math.sin(phase + layer.fm * Math.sin(phase * 1.51));
      }
      samples[start + i] += value * envelope * (layer.gain ?? 1);
    }
  }

  // Quiet echoes add space without stretching fast collision sounds.
  const dry = samples.slice();
  for (const [delaySeconds, gain] of [
    [0.047, 0.12],
    [0.089, 0.05],
  ]) {
    const delay = Math.round(delaySeconds * RATE);
    for (let i = delay; i < samples.length; i++) samples[i] += dry[i - delay] * gain;
  }
  const mean = samples.reduce((total, value) => total + value, 0) / samples.length;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    // Remove DC and fade both boundaries to avoid clicks.
    samples[i] = (samples[i] - mean) * Math.min(1, i / 88, (samples.length - 1 - i) / 441);
    if (!Number.isFinite(samples[i])) throw new Error('Non-finite audio sample');
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (peak < 0.001) throw new Error('Silent effect');
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(RATE, 24);
  wav.writeUInt32LE(RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    wav.writeInt16LE(Math.round((samples[i] / peak) * 0.7 * 32767), 44 + i * 2);
  }
  return wav;
}

const tone = (from, to, duration, gain = 1, extra = {}) => ({ from, to, duration, gain, ...extra });
const noise = (duration, gain, cutoff, extra = {}) => ({
  noise: true,
  duration,
  gain,
  cutoff,
  ...extra,
});
const notes = (frequencies, spacing, duration, gain = 0.5) =>
  frequencies.map((frequency, index) =>
    tone(frequency, frequency, duration, gain, { at: index * spacing, decay: 3, attack: 0.005 }),
  );

// Each design follows its gameplay role, without reproducing a reference recording.
const effects = {
  'fire-cannon': [
    0.48,
    [
      tone(180, 42, 0.36, 1, { decay: 6 }),
      noise(0.13, 0.85, 2200, { decay: 7 }),
      tone(65, 35, 0.32, 0.5),
    ],
  ],
  'fire-laser': [
    0.28,
    [tone(2100, 240, 0.19, 0.7, { fm: 1.6, decay: 4 }), tone(1050, 120, 0.16, 0.25)],
  ],
  'fire-missile': [
    0.61,
    [
      noise(0.47, 1, 2600, { attack: 0.04, decay: 2.8 }),
      tone(180, 560, 0.34, 0.26, { attack: 0.03 }),
      noise(0.07, 0.4, 700),
    ],
  ],
  'fire-mortar': [
    0.52,
    [
      tone(110, 30, 0.4, 1, { decay: 5 }),
      noise(0.19, 0.65, 850, { decay: 6 }),
      tone(420, 95, 0.16, 0.22),
    ],
  ],
  'impact-armor': [
    0.26,
    [
      tone(480, 300, 0.19, 0.6, { metal: true, decay: 4 }),
      tone(160, 95, 0.2, 0.55, { decay: 4 }),
      noise(0.07, 0.25, 2200, { decay: 6 }),
    ],
  ],
  'impact-core': [
    0.34,
    [tone(240, 55, 0.23, 0.9, { fm: 1.2, decay: 5 }), noise(0.14, 0.65, 1500, { decay: 6 })],
  ],
  'impact-miss': [
    0.22,
    [
      noise(0.12, 0.9, 3200, { highpass: true, attack: 0.012, decay: 4 }),
      tone(750, 320, 0.09, 0.14),
    ],
  ],
  'impact-shield': [
    0.32,
    [
      tone(680, 340, 0.24, 0.55, { fm: 1.2, decay: 4 }),
      tone(190, 125, 0.23, 0.6, { decay: 3.5 }),
      noise(0.055, 0.1, 3000, { highpass: true }),
    ],
  ],
  'activate-buff': [0.62, notes([440, 554.37, 659.25, 880], 0.095, 0.22)],
  'activate-debuff': [
    0.62,
    [...notes([622.25, 493.88, 369.99, 233.08], 0.09, 0.24), noise(0.3, 0.12, 1700, { at: 0.18 })],
  ],
  'core-death': [
    1.55,
    [
      noise(1.28, 1.2, 1200, { decay: 6 }),
      tone(170, 22, 1.15, 1, { decay: 5 }),
      noise(0.25, 0.6, 4500, { decay: 8 }),
      tone(630, 95, 0.6, 0.28, { fm: 2, at: 0.07 }),
      noise(0.65, 0.3, 550, { at: 0.35, decay: 4 }),
    ],
  ],
  'core-repair': [
    0.66,
    [
      ...notes([523.25, 659.25, 783.99], 0.12, 0.25, 0.45),
      tone(1046.5, 1046.5, 0.22, 0.2, { at: 0.25, decay: 3 }),
    ],
  ],
  'core-shield-up': [
    0.83,
    [
      tone(180, 950, 0.55, 0.5, { attack: 0.08, decay: 0.8, fm: 0.5 }),
      ...notes([659.25, 987.77], 0.12, 0.22, 0.3).map((layer) => ({
        ...layer,
        at: layer.at + 0.38,
      })),
    ],
  ],
  'core-shield-down': [
    0.76,
    [
      tone(1100, 95, 0.5, 0.55, { fm: 2.5, decay: 3 }),
      noise(0.35, 0.55, 3500, { highpass: true, decay: 6 }),
      tone(260, 45, 0.48, 0.4),
    ],
  ],
};

let seed = 104729;
for (const [name, [duration, layers]] of Object.entries(effects)) {
  writeFileSync(new URL(`${name}.wav`, destination), render(duration, seed++, layers));
}
