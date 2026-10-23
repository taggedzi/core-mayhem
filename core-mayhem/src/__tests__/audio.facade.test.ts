import { afterEach, describe, expect, it, vi } from 'vitest';

const manager = vi.hoisted(() => ({
  ensure: vi.fn(),
  preloadAll: vi.fn(async () => {}),
  play: vi.fn(),
  duckMusic: vi.fn(),
  duckBus: vi.fn(),
  startLoop: vi.fn(),
  stopLoop: vi.fn(),
  setMasterVolume: vi.fn(),
  setBusVolume: vi.fn(),
  playUrl: vi.fn(async () => {}),
  stopChannel: vi.fn(),
  setMusicPlaylist: vi.fn(),
  playMusic: vi.fn(),
  stopMusic: vi.fn(),
  nextTrack: vi.fn(),
  prevTrack: vi.fn(),
  hasPlaylist: vi.fn(() => true),
  isMusicPlaying: vi.fn(() => true),
  getMusicBinCount: vi.fn(() => 32),
  getMusicSpectrum: vi.fn(() => true),
  cancelResume: vi.fn(),
}));
vi.mock('../audio/AudioManager', () => ({
  AudioManager: class {
    constructor() {
      return manager;
    }
  },
}));

describe('audio facade', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([false, true])(
    'provides safe defaults or forwards every method (Web Audio: %s)',
    async (available) => {
      vi.resetModules();
      vi.stubGlobal('AudioContext', available ? class {} : undefined);
      const { audio } = await import('../audio');
      const spectrum = new Uint8Array(32);
      const calls: [string, unknown[], string, unknown[]][] = [
        ['preloadAll', [], 'preloadAll', []],
        ['play', ['fire_cannon', { volume: 0.4 }], 'play', ['fire_cannon', { volume: 0.4 }]],
        ['duck', [0.5, 100], 'duckMusic', [0.5, 100]],
        ['duckSfx', [0.3, 200], 'duckBus', ['sfx', 0.3, 200]],
        [
          'startLoop',
          ['alarm', 'core_low_hp_alarm', 0.2],
          'startLoop',
          ['alarm', 'core_low_hp_alarm', 0.2],
        ],
        ['stopLoop', ['alarm'], 'stopLoop', ['alarm']],
        ['setMasterVolume', [0.5], 'setMasterVolume', [0.5]],
        ['setSfxVolume', [0.4], 'setBusVolume', ['sfx', 0.4]],
        ['setMusicVolume', [0.3], 'setBusVolume', ['music', 0.3]],
        ['setAnnouncerVolume', [0.2], 'setBusVolume', ['announcer', 0.2]],
        [
          'playUrl',
          ['clip.wav', { channel: 'announcer' }],
          'playUrl',
          ['clip.wav', { channel: 'announcer' }],
        ],
        ['stopAnnouncer', [], 'stopChannel', ['announcer']],
        ['setMusicPlaylist', [['a.mp3']], 'setMusicPlaylist', [['a.mp3']]],
        ...['playMusic', 'stopMusic', 'nextTrack', 'prevTrack', 'cancelResume'].map(
          (name) => [name, [], name, []] as [string, unknown[], string, unknown[]],
        ),
      ];
      for (const [method, args, target, forwarded] of calls) {
        await (audio as any)[method](...args);
        if (available) expect((manager as any)[target]).toHaveBeenCalledWith(...forwarded);
        else expect((manager as any)[target]).not.toHaveBeenCalled();
      }
      expect(audio.hasPlaylist()).toBe(available);
      expect(audio.isMusicPlaying()).toBe(available);
      expect(audio.getMusicBinCount()).toBe(available ? 32 : 0);
      expect(audio.getMusicSpectrum(spectrum)).toBe(available);
      expect(manager.ensure).toHaveBeenCalledTimes(available ? 1 : 0);
    },
  );

  it('absorbs preload failures', async () => {
    vi.resetModules();
    vi.stubGlobal('AudioContext', class {});
    manager.preloadAll.mockRejectedValueOnce(new Error('offline'));
    const { audio } = await import('../audio');
    audio.preloadAll();
    await Promise.resolve();
    expect(manager.preloadAll).toHaveBeenCalledOnce();
  });
  it('absorbs asynchronous playback and loop failures', async () => {
    vi.resetModules();
    vi.stubGlobal('AudioContext', class {});
    manager.play.mockRejectedValueOnce(new Error('decode failed'));
    manager.startLoop.mockRejectedValueOnce(new Error('network failed'));
    manager.playMusic.mockRejectedValueOnce(new Error('play failed'));
    manager.playUrl.mockRejectedValueOnce(new Error('voice failed'));
    const { audio } = await import('../audio');
    audio.play('fire_cannon');
    audio.startLoop('alarm', 'core_low_hp_alarm');
    audio.playMusic();
    await expect(audio.playUrl('voice.wav')).resolves.toBeUndefined();
    await Promise.resolve();
  });
});
