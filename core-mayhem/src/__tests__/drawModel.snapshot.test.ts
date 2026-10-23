import { World } from 'matter-js';
import { describe, it, expect, vi } from 'vitest';

import { audio } from '../audio';
import { toDrawCommands } from '../render/drawModel';
import { sim } from '../state';
import { invalidateManualPersonaCache } from '../ui/characters';

describe('toDrawCommands (pure render adapter)', () => {
  it('emits core circle commands at expected positions', () => {
    sim.W = 640 as any;
    sim.H = 360 as any;
    sim.coreL = { center: { x: 100, y: 200 }, ringR: 22 } as any;
    sim.coreR = { center: { x: 540, y: 200 }, ringR: 22 } as any;

    const scene = toDrawCommands();
    const circles = scene.commands.filter((c) => c.kind === 'circle');

    // Just check we have a circle at each core center; ignore r/lineWidth
    expect(circles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'circle', x: 100, y: 200 }),
        expect.objectContaining({ kind: 'circle', x: 540, y: 200 }),
      ]),
    );
  });

  it('beat sensitivity and chiptune mode change the music pulse', () => {
    sim.W = 640 as any;
    sim.H = 360 as any;
    sim.coreL = { center: { x: 100, y: 200 }, ringR: 22 } as any;
    sim.coreR = { center: { x: 540, y: 200 }, ringR: 22 } as any;
    // Modest low-band energy stays under the flux clamp, so beat 0.5 and 2 stay distinct.
    const spec = new Uint8Array(32);
    spec[0] = 40;
    spec[1] = 40;
    spec[2] = 40;
    const bins = vi.spyOn(audio, 'getMusicBinCount').mockReturnValue(spec.length);
    const spectrum = vi.spyOn(audio, 'getMusicSpectrum').mockImplementation((out: Uint8Array) => {
      out.set(spec.subarray(0, out.length));
      return true;
    });

    const sample = (
      beat: number | undefined,
      chip: string,
    ): { pulse: number; lineWidth: number } => {
      (sim as any).vizSens = 1;
      if (beat === undefined) delete (sim as any).beatSens;
      else (sim as any).beatSens = beat;
      (sim as any).chipMode = chip;
      (sim as any)._musicFFT = undefined;
      (sim as any)._musicPrev = undefined;
      (sim as any)._musicFFTLastT = 0;
      (sim as any)._musicFlux = 0;
      (sim as any).musicPulse = 0;
      (sim as any).musicPulseLastT = 1;
      (sim as any).musicEnv = 0;
      (sim as any).musicEnvLastT = 1;
      (sim as any).mesmer = {};
      (sim as any).mesmerFade = 1;
      (sim as any).mesmerLastT = 1;
      const scene = toDrawCommands(100_000);
      const arc = scene.commands.find((c) => c.kind === 'arc');
      return {
        pulse: Number((sim as any).musicPulse),
        lineWidth: Number((arc as any)?.lineWidth ?? 0),
      };
    };

    try {
      const lowBeat = sample(0.5, 'off');
      const highBeat = sample(2, 'off');
      const chipOff = sample(1, 'off');
      const chipOn = sample(1, 'on');
      const chipAuto = sample(1, 'auto');
      const beatDefault = sample(undefined, 'off');

      expect(lowBeat.pulse).toBeGreaterThan(0);
      expect(highBeat.pulse).toBeGreaterThan(lowBeat.pulse);
      expect(highBeat.lineWidth).toBeGreaterThan(lowBeat.lineWidth);
      expect(chipOff.pulse).toBeGreaterThan(chipOn.pulse);
      expect(chipOff.lineWidth).toBeGreaterThan(chipOn.lineWidth);
      expect(chipAuto.pulse).toBeCloseTo(chipOff.pulse);
      expect(beatDefault.pulse).toBeCloseTo(chipOff.pulse);
    } finally {
      bins.mockRestore();
      spectrum.mockRestore();
    }
  });

  it('skips profile storage when the match persona is already known', () => {
    sim.W = 640 as any;
    sim.H = 360 as any;
    sim.coreL = { center: { x: 100, y: 200 }, ringR: 22 } as any;
    sim.coreR = { center: { x: 540, y: 200 }, ringR: 22 } as any;
    sim.world = World.create();
    (sim as any).banterL = { personality: { name: 'Alpha' }, displayName: 'Alpha', id: 'left' };
    (sim as any).banterR = { personality: { name: 'Beta' }, displayName: 'Beta', id: 'right' };
    (sim as any).matchPersonaL = 'DarkCore';
    (sim as any).matchPersonaR = 'LightCore';
    const spy = vi.spyOn(Storage.prototype, 'getItem');
    const labels = (): string[] =>
      toDrawCommands()
        .commands.filter((command) => command.kind === 'textBox')
        .map((command) => String((command as { text?: string }).text));
    const first = labels();
    const second = labels();
    expect(second).toEqual(first);
    expect(first.some((text) => text.includes('Alpha') && text.includes('Dark'))).toBe(true);
    expect(first.some((text) => text.includes('Beta') && text.includes('Light'))).toBe(true);
    expect(spy.mock.calls.some((call) => call[0] === 'cm_char_L' || call[0] === 'cm_char_R')).toBe(
      false,
    );
  });

  it('parses saved personas once and refreshes them after a profile change', () => {
    sim.W = 640 as any;
    sim.H = 360 as any;
    sim.coreL = { center: { x: 100, y: 200 }, ringR: 22 } as any;
    sim.coreR = { center: { x: 540, y: 200 }, ringR: 22 } as any;
    sim.world = World.create();
    (sim as any).banterL = { personality: { name: 'Alpha' }, displayName: 'Alpha', id: 'left' };
    (sim as any).banterR = { personality: { name: 'Beta' }, displayName: 'Beta', id: 'right' };
    (sim as any).matchPersonaL = '';
    (sim as any).matchPersonaR = null;
    localStorage.setItem('cm_char_L', JSON.stringify({ persona: 'DarkCore' }));
    localStorage.setItem('cm_char_R', JSON.stringify({ persona: 'LightCore' }));
    invalidateManualPersonaCache();
    const labels = (): string[] =>
      toDrawCommands()
        .commands.filter((command) => command.kind === 'textBox')
        .map((command) => String((command as { text?: string }).text));
    const spy = vi.spyOn(Storage.prototype, 'getItem');
    const first = labels();
    spy.mockClear();
    expect(labels()).toEqual(first);
    expect(spy.mock.calls.some((call) => call[0] === 'cm_char_L' || call[0] === 'cm_char_R')).toBe(
      false,
    );
    expect(first.some((text) => text.includes('Alpha') && text.includes('Dark'))).toBe(true);

    localStorage.setItem('cm_char_L', JSON.stringify({ persona: 'ChaosCore' }));
    expect(labels()).toEqual(first);
    invalidateManualPersonaCache();
    const fresh = labels();
    expect(fresh.some((text) => text.includes('Chaos'))).toBe(true);
    expect(fresh).not.toEqual(first);
    localStorage.removeItem('cm_char_L');
    localStorage.removeItem('cm_char_R');
    invalidateManualPersonaCache();
  });
});
