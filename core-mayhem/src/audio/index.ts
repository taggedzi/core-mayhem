import { AudioManager } from './AudioManager';
import { AUDIO_DEFAULTS, SOUNDS } from './config';

import type { Channel, SoundKey } from './keys';

// Safe singleton: no-op in non-browser environments
class AudioFacade {
  private mgr: AudioManager | null = null;

  private get(): AudioManager | null {
    if (this.mgr) return this.mgr;
    if (typeof window === 'undefined' || (window as any).AudioContext === undefined) return null;
    this.mgr = new AudioManager(SOUNDS, AUDIO_DEFAULTS as any);
    this.mgr.ensure();
    return this.mgr;
  }

  preloadAll(): void { this.get()?.preloadAll().catch(() => void 0); }
  play(key: SoundKey, o?: { volume?: number; rate?: number; detune?: number }): void { void this.get()?.play(key, o); }
  duck(factor: number, ms?: number): void { this.get()?.duckMusic(factor, ms); }
  duckSfx(factor: number, ms?: number): void { this.get()?.duckBus('sfx', factor, ms); }
  startLoop(id: string, key: SoundKey, volume?: number): void { void this.get()?.startLoop(id, key, volume); }
  stopLoop(id: string): void { this.get()?.stopLoop(id); }
  setMasterVolume(v: number): void { this.get()?.setMasterVolume(v); }
  setSfxVolume(v: number): void { this.get()?.setBusVolume('sfx', v); }
  setMusicVolume(v: number): void { this.get()?.setBusVolume('music', v); }
  setAnnouncerVolume(v: number): void { this.get()?.setBusVolume('announcer', v); }
  playUrl(url: string, opts?: { channel?: Channel; volume?: number; rate?: number; detune?: number }): void { void this.get()?.playUrl(url, opts); }
  stopAnnouncer(): void { this.get()?.stopChannel('announcer'); }
  // Music playlist helpers (public assets)
  setMusicPlaylist(urls: string[]): void { this.get()?.setMusicPlaylist(urls); }
  playMusic(): void { void this.get()?.playMusic(); }
  stopMusic(): void { this.get()?.stopMusic(); }
  nextTrack(): void { this.get()?.nextTrack(); }
  prevTrack(): void { this.get()?.prevTrack(); }
  hasPlaylist(): boolean { return this.get()?.hasPlaylist() ?? false; }
  isMusicPlaying(): boolean { return this.get()?.isMusicPlaying() ?? false; }
  getMusicBinCount(): number { return this.get()?.getMusicBinCount() ?? 0; }
  getMusicSpectrum(out: Uint8Array): boolean { return this.get()?.getMusicSpectrum(out) ?? false; }
}

export const audio = new AudioFacade();
