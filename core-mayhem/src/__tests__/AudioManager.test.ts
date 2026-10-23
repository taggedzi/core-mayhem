import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AudioManager } from '../audio/AudioManager';

import type { SoundSpec } from '../audio/config';
import type { SoundKey } from '../audio/keys';

// ---- Minimal Web Audio mocks --------------------------------------------
class MockGainNode {
  public gain = {
    value: 1,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  } as any;
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAnalyser {
  fftSize = 0;
  smoothingTimeConstant = 0;
  minDecibels = 0;
  maxDecibels = 0;
  frequencyBinCount = 512;
  connect = vi.fn();
  getByteFrequencyData = vi.fn((out: Uint8Array) => {
    if (out.length) out[0] = 1;
  });
}

type EndListener = (() => void) | null;
class MockBufferSource {
  buffer: any = null;
  loop = false;
  playbackRate = { value: 1 } as any;
  detune = { value: 0 } as any;
  connect = vi.fn();
  _onEnd: EndListener = null;
  start = vi.fn(() => {
    /* autoplay, end when stopped */
  });
  stop = vi.fn(() => {
    this._onEnd?.();
  });
  disconnect = vi.fn();
  addEventListener = vi.fn((ev: string, cb: () => void) => {
    if (ev === 'ended') this._onEnd = cb;
  });
}

const createdSources: MockBufferSource[] = [];

class MockAudioContext {
  currentTime = 1;
  destination = {} as any;
  createGain(): any {
    return new MockGainNode();
  }
  createBufferSource(): any {
    const s = new MockBufferSource();
    createdSources.push(s);
    return s;
  }
  decodeAudioData = async (_arr: ArrayBuffer): Promise<any> => ({ duration: 1 }) as any;
  createMediaElementSource = (_el: HTMLAudioElement): any => ({ connect: vi.fn() });
  createAnalyser = (): any => new MockAnalyser();
  resume = vi.fn(async () => {});
}

// Minimal HTMLAudioElement mock
class MockHTMLAudioElement {
  preload = '';
  crossOrigin: string | null = null;
  loop = false;
  src = '';
  paused = true;
  currentTime = 0;
  private endedCb: (() => void) | null = null;
  addEventListener = (ev: string, cb: () => void): void => {
    if (ev === 'ended') this.endedCb = cb;
  };
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  triggerEnded = (): void => {
    this.endedCb?.();
  };
}

// ---- Test helpers --------------------------------------------------------
const makeMgr = (
  sounds: Record<SoundKey, SoundSpec>,
  defaults?: Partial<ConstructorParameters<typeof AudioManager>[1]>,
): AudioManager => {
  const def = {
    enabled: true,
    masterVolume: 1,
    sfxVolume: 1,
    musicVolume: 1,
    announcerVolume: 1,
    duckReleaseMs: 600,
    ...defaults,
  } as any;
  return new AudioManager(sounds, def);
};

describe('AudioManager', () => {
  let RealAC: any;
  let RealAudio: any;

  beforeEach(() => {
    createdSources.length = 0;
    vi.restoreAllMocks();
    RealAC = (window as any).AudioContext;
    (window as any).AudioContext = MockAudioContext as any;
    RealAudio = (globalThis as any).Audio;
    (globalThis as any).Audio = MockHTMLAudioElement as any;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(8),
    } as any);
  });

  afterEach(() => {
    (window as any).AudioContext = RealAC;
    (globalThis as any).Audio = RealAudio;
    vi.restoreAllMocks();
  });

  it('ensure() initializes context and buses and resumes on user gesture', async () => {
    const mgr = makeMgr({} as any);
    mgr.ensure();
    // trigger the resume listeners to ensure no throw
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('keydown'));
    // volumes
    mgr.setMasterVolume(0.5);
    mgr.setBusVolume('music', 0.8);
    // duck uses scheduling on the bus.gain
    mgr.duckMusic(0.5, 1000);
    const musicGain: MockGainNode = (mgr as any).bus.music;
    expect(musicGain.gain.linearRampToValueAtTime).toHaveBeenCalled();
  });

  it('preloadAll loads and caches buffers', async () => {
    const sounds = { fire_cannon: { src: 'a.ogg' } as SoundSpec } as any;
    const mgr = makeMgr(sounds);
    await mgr.preloadAll();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    // call again should use cache (no extra fetch)
    await mgr.preloadAll();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('playUrl connects to bus and registers end handler; stopChannel stops and clears', async () => {
    const mgr = makeMgr({} as any);
    await mgr.playUrl('x.ogg', { channel: 'sfx', volume: 0.7, rate: 1.2, detune: 10 });
    expect(createdSources.length).toBe(1);
    // Stopping the channel should invoke stop on created source
    mgr.stopChannel('sfx');
    expect(createdSources[0]!.stop).toHaveBeenCalled();
  });

  it('play enforces cooldown and maxConcurrent, and ducks music when configured', async () => {
    // Keep the first play beyond the cooldown even when the suite starts quickly.
    vi.spyOn(performance, 'now').mockReturnValue(10000);
    const sounds: Record<SoundKey, SoundSpec> = {
      fire_cannon: { src: 'laser.ogg', cooldownMs: 1000, maxConcurrent: 1, duckMusic: 0.5 },
    } as any;
    const mgr = makeMgr(sounds);
    await mgr.play('fire_cannon');
    // second call immediately should be blocked by cooldown (no new source)
    await mgr.play('fire_cannon');
    expect(createdSources.length).toBe(1);
  });

  it('does not start an interrupted announcement when its fetch finishes', async () => {
    let complete!: (response: Response) => void;
    vi.mocked(globalThis.fetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    const mgr = makeMgr({} as any);
    const loading = mgr.playUrl('interrupted.wav', { channel: 'announcer' });
    mgr.stopChannel('announcer');
    complete({ arrayBuffer: async () => new ArrayBuffer(8) } as Response);
    await loading;
    expect(createdSources).toHaveLength(0);
  });

  it('loops: startLoop once per id, then stopLoop and stopAll', async () => {
    const sounds: Record<SoundKey, SoundSpec> = {
      core_low_hp_alarm: { src: 'alarm.ogg', loop: true },
    } as any;
    const mgr = makeMgr(sounds);
    await mgr.startLoop('alarm', 'core_low_hp_alarm', 0.3);
    await mgr.startLoop('alarm', 'core_low_hp_alarm'); // no duplicate
    expect(createdSources.length).toBe(1);
    mgr.stopLoop('alarm');
    await mgr.startLoop('alarm', 'core_low_hp_alarm');
    expect(createdSources.length).toBe(2);
    mgr.stopAll();
  });

  it.each(['disabled', 'unsupported'] as const)('safely skips audio when %s', async (mode) => {
    if (mode === 'unsupported') (window as any).AudioContext = undefined;
    const mgr = makeMgr({} as any, { enabled: mode !== 'disabled' });
    await mgr.preloadAll();
    await mgr.play('fire_cannon');
    await mgr.playUrl('missing.wav');
    await mgr.startLoop('alarm', 'core_low_hp_alarm');
    mgr.setMasterVolume(0.5);
    mgr.setBusVolume('sfx', 0.5);
    mgr.duckMusic(0.5);
    mgr.duckBus('sfx', 0.5);
    await mgr.playMusic();
    mgr.nextTrack();
    mgr.prevTrack();
    mgr.stopMusic();
    mgr.stopLoop('absent');
    mgr.cancelResume();
    expect(mgr.getMusicBinCount()).toBe(0);
    expect(mgr.getMusicSpectrum(new Uint8Array(1))).toBe(false);
    expect(mgr.isMusicPlaying()).toBe(false);
    expect(createdSources).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses sound defaults, overrides, and frees concurrency after a source ends', async () => {
    const mgr = makeMgr({
      fire_cannon: { src: 'a.wav', maxConcurrent: 1, volume: 0.3, rate: 0.8, detune: -10 },
    } as any);
    await mgr.play('fire_cannon');
    expect(createdSources[0]!.playbackRate.value).toBe(0.8);
    expect(createdSources[0]!.detune.value).toBe(-10);
    await mgr.play('fire_cannon');
    expect(createdSources).toHaveLength(1);
    createdSources[0]!.stop();
    await mgr.play('fire_cannon', { rate: 1.5, detune: 20, volume: 2 });
    expect(createdSources).toHaveLength(2);
    expect(createdSources[1]!.playbackRate.value).toBe(1.5);
    expect(createdSources[1]!.detune.value).toBe(20);
    await mgr.play('core_low_hp_alarm');
    await mgr.startLoop('unknown', 'core_low_hp_alarm');
    expect(createdSources).toHaveLength(2);
    mgr.cancelResume();
    mgr.cancelResume();
  });

  it('clamps volumes and ducks buses back to their configured level', () => {
    const mgr = makeMgr({} as any);
    mgr.setMasterVolume(2);
    expect((mgr as any).master.gain.value).toBe(1);
    mgr.setMasterVolume(-1);
    expect((mgr as any).master.gain.value).toBe(0);
    mgr.setBusVolume('sfx', 0.4);
    mgr.duckBus('sfx', 0.5);
    const gain = (mgr as any).bus.sfx.gain;
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.2, 1.04);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.4, 1.6);
    mgr.duckMusic(2);
    mgr.cancelResume();
  });

  it('cancels queued URL playback when disabled during loading', async () => {
    let finish!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const mgr = makeMgr({} as any);
    const pending = mgr.playUrl('a.wav');
    mgr.setEnabled(false);
    finish({ arrayBuffer: async () => new ArrayBuffer(8) } as Response);
    await pending;
    expect(createdSources).toHaveLength(0);
    mgr.setEnabled(true);
    await mgr.playUrl('a.wav');
    expect(createdSources).toHaveLength(1);
    expect(createdSources[0]!.playbackRate.value).toBe(1);
    expect(createdSources[0]!.detune.value).toBe(0);
    mgr.cancelResume();
  });

  it('continues when preloading fails and gracefully handles a failed context', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    const mgr = makeMgr({ fire_cannon: { src: 'a.wav' } } as any);
    await expect(mgr.preloadAll()).resolves.toBeUndefined();
    mgr.cancelResume();
    (window as any).AudioContext = class {
      constructor() {
        throw new Error('unavailable');
      }
    };
    const failed = makeMgr({} as any);
    await expect(failed.playUrl('x.wav')).resolves.toBeUndefined();
    expect(createdSources).toHaveLength(0);
  });

  it('playlist playback and analyser API', async () => {
    const mgr = makeMgr({} as any);
    mgr.setMusicPlaylist(['t1.mp3', 't2.mp3']);
    expect(mgr.hasPlaylist()).toBe(true);
    await mgr.playMusic();
    expect(mgr.isMusicPlaying()).toBe(true);
    mgr.stopMusic();
    expect(mgr.isMusicPlaying()).toBe(false);
    // next/prev should not throw
    await mgr.nextTrack();
    await mgr.prevTrack();
    // Analyser
    const bins = mgr.getMusicBinCount();
    expect(bins).toBeGreaterThan(0);
    const out = new Uint8Array(8);
    const ok = mgr.getMusicSpectrum(out);
    expect(ok).toBe(true);
    expect(out[0]).toBe(1);
  });
  function deferredFetch(): () => void {
    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    return () => resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response);
  }

  it('shares a pending load and reserves the concurrent slot before awaiting', async () => {
    const finish = deferredFetch();
    const mgr = makeMgr({ fire_cannon: { src: 'shared.wav', maxConcurrent: 1 } } as any);
    const a = mgr.play('fire_cannon');
    const b = mgr.play('fire_cannon');
    const c = mgr.playUrl('shared.wav');
    expect(fetch).toHaveBeenCalledTimes(1);
    finish();
    await Promise.all([a, b, c]);
    expect(createdSources).toHaveLength(2);
    mgr.stopAll();
    expect(createdSources.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
  });

  it('reserves cooldown before a concurrent first load', async () => {
    const finish = deferredFetch();
    const mgr = makeMgr({ fire_cannon: { src: 'cooldown.wav', cooldownMs: 1000 } } as any);
    const a = mgr.play('fire_cannon');
    const b = mgr.play('fire_cannon');
    finish();
    await Promise.all([a, b]);
    expect(createdSources).toHaveLength(1);
  });

  it('deduplicates pending loops and allows stopping them before loading completes', async () => {
    const finish = deferredFetch();
    const mgr = makeMgr({ core_low_hp_alarm: { src: 'alarm.wav' } } as any);
    const a = mgr.startLoop('alarm', 'core_low_hp_alarm');
    const b = mgr.startLoop('alarm', 'core_low_hp_alarm');
    mgr.stopLoop('alarm');
    finish();
    await Promise.all([a, b]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(createdSources).toHaveLength(0);
    await mgr.startLoop('alarm', 'core_low_hp_alarm');
    await mgr.startLoop('alarm', 'core_low_hp_alarm');
    expect(createdSources).toHaveLength(1);
    mgr.stopAll();
    expect(createdSources[0]!.stop).toHaveBeenCalledOnce();
  });

  it.each(['stopAll', 'disable'] as const)(
    'cancels every pending channel on %s',
    async (action) => {
      const finish = deferredFetch();
      const mgr = makeMgr({
        fire_cannon: { src: 'shared.wav' },
        core_low_hp_alarm: { src: 'shared.wav' },
      } as any);
      const tasks = [
        mgr.play('fire_cannon'),
        mgr.startLoop('alarm', 'core_low_hp_alarm'),
        mgr.playUrl('shared.wav', { channel: 'announcer' }),
      ];
      if (action === 'disable') mgr.setEnabled(false);
      else mgr.stopAll();
      finish();
      await Promise.all(tasks);
      expect(createdSources).toHaveLength(0);
    },
  );

  it('retries failed loads without leaking a playback reservation or cooldown', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    const mgr = makeMgr({
      fire_cannon: { src: 'retry.wav', maxConcurrent: 1, cooldownMs: 1000 },
    } as any);
    await expect(mgr.play('fire_cannon')).rejects.toThrow('offline');
    await mgr.play('fire_cannon');
    expect(createdSources).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('disable silences music, announcer and one-shots already playing', async () => {
    const mgr = makeMgr({ fire_cannon: { src: 'sound.wav' } } as any);
    mgr.setMusicPlaylist(['music.mp3']);
    await mgr.playMusic();
    await mgr.play('fire_cannon');
    await mgr.playUrl('voice.wav', { channel: 'announcer' });
    mgr.setEnabled(false);
    expect(mgr.isMusicPlaying()).toBe(false);
    expect(createdSources.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
    await mgr.playMusic();
    expect(mgr.isMusicPlaying()).toBe(false);
  });
});
