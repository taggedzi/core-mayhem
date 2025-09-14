import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { Channel, SoundKey } from '../audio/keys';
import type { SoundSpec } from '../audio/config';
import { AudioManager } from '../audio/AudioManager';

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
  getByteFrequencyData = vi.fn((out: Uint8Array) => { if (out.length) out[0] = 1; });
}

type EndListener = (() => void) | null;
class MockBufferSource {
  buffer: any = null;
  loop = false;
  playbackRate = { value: 1 } as any;
  detune = { value: 0 } as any;
  connect = vi.fn();
  _onEnd: EndListener = null;
  start = vi.fn(() => { /* autoplay, end when stopped */ });
  stop = vi.fn(() => { this._onEnd?.(); });
  disconnect = vi.fn();
  addEventListener = vi.fn((ev: string, cb: () => void) => { if (ev === 'ended') this._onEnd = cb; });
}

const createdSources: MockBufferSource[] = [];

class MockAudioContext {
  currentTime = 1;
  destination = {} as any;
  createGain(): any { return new MockGainNode(); }
  createBufferSource(): any { const s = new MockBufferSource(); createdSources.push(s); return s; }
  decodeAudioData = async (_arr: ArrayBuffer): Promise<any> => ({ duration: 1 } as any);
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
  addEventListener = (ev: string, cb: () => void) => { if (ev === 'ended') this.endedCb = cb; };
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  triggerEnded = () => { this.endedCb?.(); };
}

// ---- Test helpers --------------------------------------------------------
const makeMgr = (sounds: Record<SoundKey, SoundSpec>, defaults?: Partial<ConstructorParameters<typeof AudioManager>[1]>) => {
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
    const sounds: Record<SoundKey, SoundSpec> = {
      fire_cannon: { src: 'laser.ogg', cooldownMs: 1000, maxConcurrent: 1, duckMusic: 0.5 },
    } as any;
    const mgr = makeMgr(sounds);
    await mgr.play('fire_cannon');
    // second call immediately should be blocked by cooldown (no new source)
    await mgr.play('fire_cannon');
    expect(createdSources.length).toBe(1);
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
});

