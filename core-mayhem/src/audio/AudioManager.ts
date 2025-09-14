import type { SoundSpec } from './config';
import type { Channel, SoundKey } from './keys';

interface PlayOpts {
  volume?: number;
  rate?: number;
  detune?: number;
}

type Ctx = AudioContext;

// Minimal, safe, browser-only audio manager using Web Audio API.
export class AudioManager {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private bus: Record<Channel, GainNode | null> = { sfx: null, music: null, announcer: null };
  private buffers = new Map<string, AudioBuffer>();
  private lastPlayAt = new Map<SoundKey, number>();
  private instances = new Map<SoundKey, number>();
  private loops = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  private baseGain: Record<Channel, number> = { sfx: 1.0, music: 1.0, announcer: 1.0 };
  private chanNodes: Record<Channel, Set<{ src: AudioBufferSourceNode; gain: GainNode }>> = {
    sfx: new Set(),
    music: new Set(),
    announcer: new Set(),
  };
  private enabled = true;
  // Streaming music via media element for large files
  private musicEl: HTMLAudioElement | null = null;
  private musicNode: MediaElementAudioSourceNode | null = null;
  private musicAnalyser: AnalyserNode | null = null;
  private playlist: string[] = [];
  private plIndex = 0;

  constructor(
    private sounds: Record<SoundKey, SoundSpec>,
    private defaults: { masterVolume: number; sfxVolume: number; musicVolume: number; announcerVolume: number; duckReleaseMs: number; enabled: boolean },
  ) {
    this.enabled = !!defaults.enabled;
  }

  private hasWebAudio(): boolean {
    return typeof window !== 'undefined' && (window as any).AudioContext !== undefined;
  }

  ensure(): void {
    if (!this.enabled) return;
    if (this.ctx || !this.hasWebAudio()) return;
    try {
      const CtxCtor = (window as any).AudioContext as new () => Ctx;
      this.ctx = new CtxCtor();
      this.master = this.ctx.createGain();
      this.bus.sfx = this.ctx.createGain();
      this.bus.music = this.ctx.createGain();
      this.bus.announcer = this.ctx.createGain();
      // music analyser for visualizers
      try {
        this.musicAnalyser = this.ctx.createAnalyser();
        this.musicAnalyser.fftSize = 1024;
        this.musicAnalyser.smoothingTimeConstant = 0.85;
        this.musicAnalyser.minDecibels = -90;
        this.musicAnalyser.maxDecibels = -10;
      } catch { /* ignore */ }
      this.master.gain.value = this.defaults.masterVolume;
      (this.bus.sfx as GainNode).gain.value = this.defaults.sfxVolume;
      (this.bus.music as GainNode).gain.value = this.defaults.musicVolume;
      (this.bus.announcer as GainNode).gain.value = this.defaults.announcerVolume ?? 0.9;
      this.baseGain.sfx = this.defaults.sfxVolume;
      this.baseGain.music = this.defaults.musicVolume;
      this.baseGain.announcer = this.defaults.announcerVolume ?? 0.9;
      // wire graph
      (this.bus.sfx as GainNode).connect(this.master!);
      (this.bus.music as GainNode).connect(this.master!);
      (this.bus.announcer as GainNode).connect(this.master!);
      this.master.connect(this.ctx.destination);
      // attempt to resume on user gesture
      const resume = (): void => {
        this.ctx?.resume().catch(() => void 0);
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
      };
      window.addEventListener('pointerdown', resume);
      window.addEventListener('keydown', resume);
    } catch {
      // no audio
      this.ctx = null;
    }
  }

  async preloadAll(): Promise<void> {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const toLoad = Object.values(this.sounds).map((s) => s.src);
    await Promise.all(toLoad.map((url) => this.loadBuffer(url).catch(() => void 0)));
  }

  private async loadBuffer(url: string): Promise<AudioBuffer> {
    if (!this.ctx) throw new Error('no ctx');
    if (this.buffers.has(url)) return this.buffers.get(url)!;
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await this.ctx.decodeAudioData(arr);
    this.buffers.set(url, buf);
    return buf;
  }

  setEnabled(on: boolean): void {
    this.enabled = !!on;
    if (!on) this.stopAll();
  }

  setMasterVolume(v: number): void {
    this.ensure();
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  setBusVolume(ch: Channel, v: number): void {
    this.ensure();
    const g = this.bus[ch];
    if (g) g.gain.value = Math.max(0, Math.min(1, v));
    this.baseGain[ch] = Math.max(0, Math.min(1, v));
  }

  // Temporarily duck music gain; recovers over defaults.duckReleaseMs
  duckMusic(factor: number, releaseMs?: number): void {
    this.ensure();
    const music = this.bus.music;
    if (!music || !this.ctx) return;
    const f = Math.max(0, Math.min(1, factor));
    const rel = Math.max(1, releaseMs ?? this.defaults.duckReleaseMs);
    const now = this.ctx.currentTime;
    const target = this.baseGain.music * f;
    music.gain.cancelScheduledValues(now);
    music.gain.setValueAtTime(music.gain.value, now);
    music.gain.linearRampToValueAtTime(target, now + 0.04);
    music.gain.linearRampToValueAtTime(this.baseGain.music, now + rel / 1000);
  }

  // Generic bus duck; recovers over defaults.duckReleaseMs
  duckBus(ch: Exclude<Channel, 'announcer'>, factor: number, releaseMs?: number): void {
    // Do not duck announcer via this method; announcer drives the ducking
    this.ensure();
    const g = this.bus[ch];
    if (!g || !this.ctx) return;
    const f = Math.max(0, Math.min(1, factor));
    const rel = Math.max(1, releaseMs ?? this.defaults.duckReleaseMs);
    const now = this.ctx.currentTime;
    const base = this.baseGain[ch];
    const target = base * f;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(target, now + 0.04);
    g.gain.linearRampToValueAtTime(base, now + rel / 1000);
  }

  // ------- Music playlist (public/assets) using media element -------
  setMusicPlaylist(urls: string[]): void {
    this.ensure();
    this.playlist = Array.isArray(urls) ? urls.slice() : [];
    this.plIndex = 0;
  }

  async playMusic(): Promise<void> {
    this.ensure();
    if (!this.ctx || !this.bus.music || this.playlist.length === 0) return;
    const url: string = this.playlist[this.plIndex % this.playlist.length] as string;
    if (!this.musicEl) {
      this.musicEl = new Audio();
      this.musicEl.preload = 'auto';
      this.musicEl.crossOrigin = 'anonymous';
      this.musicEl.loop = false;
      this.musicEl.addEventListener('ended', () => this.nextTrack());
      try { this.musicNode = this.ctx.createMediaElementSource(this.musicEl); } catch { /* ignore */ }
      if (this.musicNode) {
        if (this.musicAnalyser) {
          this.musicNode.connect(this.musicAnalyser);
          this.musicAnalyser.connect(this.bus.music);
        } else {
          this.musicNode.connect(this.bus.music);
        }
      }
    }
    this.musicEl!.src = url;
    try { await this.musicEl!.play(); } catch { /* will resume on user gesture */ }
  }

  stopMusic(): void {
    if (this.musicEl) {
      try { this.musicEl.pause(); } catch { /* ignore */ }
      this.musicEl.currentTime = 0;
    }
  }

  nextTrack(): void {
    if (this.playlist.length === 0) return;
    this.plIndex = (this.plIndex + 1) % this.playlist.length;
    void this.playMusic();
  }

  prevTrack(): void {
    if (this.playlist.length === 0) return;
    this.plIndex = (this.plIndex - 1 + this.playlist.length) % this.playlist.length;
    void this.playMusic();
  }

  hasPlaylist(): boolean {
    return this.playlist.length > 0;
  }

  isMusicPlaying(): boolean {
    return !!this.musicEl && !this.musicEl.paused;
  }

  getMusicBinCount(): number {
    return this.musicAnalyser?.frequencyBinCount ?? 0;
  }

  getMusicSpectrum(out: Uint8Array): boolean {
    if (!this.musicAnalyser) return false;
    try {
      this.musicAnalyser.getByteFrequencyData(out);
      return true;
    } catch {
      return false;
    }
  }

  // Play an arbitrary URL (used by announcer); cached and routed to a channel
  async playUrl(url: string, opts?: { channel?: Channel; volume?: number; rate?: number; detune?: number }): Promise<void> {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const buf = await this.loadBuffer(url);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const rate = opts?.rate ?? 1.0;
    const detune = opts?.detune ?? 0;
    try { src.playbackRate.value = rate; } catch { /* ignore */ }
    try { if ((src as any).detune) { ((src as any).detune.value = detune); } } catch { /* ignore */ }
    const gain = this.ctx.createGain();
    const vol = Math.max(0, Math.min(1, opts?.volume ?? 1.0));
    gain.gain.value = vol;
    const ch = (opts?.channel ?? 'sfx') as Channel;
    const bus = this.bus[ch as Channel];
    if (!bus) return;
    src.connect(gain);
    gain.connect(bus);
    // track nodes per channel for interruption
    this.chanNodes[ch].add({ src, gain });
    src.start();
    src.addEventListener('ended', () => {
      try { src.disconnect(); gain.disconnect(); } catch { /* ignore */ }
      // remove from tracking set
      try {
        for (const pair of Array.from(this.chanNodes[ch])) {
          if (pair.src === src) this.chanNodes[ch].delete(pair);
        }
      } catch { /* ignore */ }
    });
  }

  stopChannel(ch: Channel): void {
    const set = this.chanNodes[ch];
    if (!set || set.size === 0) return;
    for (const pair of Array.from(set)) {
      try { pair.src.stop(); } catch { /* ignore */ }
      try { pair.src.disconnect(); pair.gain.disconnect(); } catch { /* ignore */ }
      set.delete(pair);
    }
  }

  async play(key: SoundKey, overrides?: PlayOpts): Promise<void> {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const spec = this.sounds[key];
    if (!spec) return;

    // cooldown
    const nowMs = performance.now();
    const last = this.lastPlayAt.get(key) ?? 0;
    if ((spec.cooldownMs ?? 0) > 0 && nowMs - last < (spec.cooldownMs as number)) return;

    // concurrent limiter
    const current = this.instances.get(key) ?? 0;
    if ((spec.maxConcurrent ?? Infinity) <= current) return;

    // load buffer
    const buf = await this.loadBuffer(spec.src);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = !!spec.loop;
    // pitch/rate
    const rate = overrides?.rate ?? spec.rate ?? 1.0;
    const detune = overrides?.detune ?? spec.detune ?? 0;
    try { src.playbackRate.value = rate; } catch { /* ignore */ }
    try { if ((src as any).detune) { ((src as any).detune.value = detune); } } catch { /* ignore */ }

    const gain = this.ctx.createGain();
    const vol = overrides?.volume ?? spec.volume ?? 1.0;
    gain.gain.value = Math.max(0, Math.min(1, vol));

    const ch = spec.channel ?? 'sfx';
    const bus = this.bus[ch];
    if (!bus) return;
    src.connect(gain);
    gain.connect(bus);

    // bookkeeping
    this.instances.set(key, current + 1);
    src.addEventListener('ended', () => {
      this.instances.set(key, Math.max(0, (this.instances.get(key) ?? 1) - 1));
      try { src.disconnect(); gain.disconnect(); } catch { /* ignore */ }
    });

    if (typeof spec.duckMusic === 'number' && spec.duckMusic < 1) {
      this.duckMusic(spec.duckMusic);
    }

    src.start();
    this.lastPlayAt.set(key, nowMs);
  }

  async startLoop(id: string, key: SoundKey, volume?: number): Promise<void> {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    if (this.loops.has(id)) return; // already looping
    const spec = this.sounds[key];
    if (!spec) return;
    const buf = await this.loadBuffer(spec.src);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume ?? spec.volume ?? 1));
    const bus = this.bus[spec.channel ?? 'sfx'];
    if (!bus) return;
    src.connect(gain);
    gain.connect(bus);
    src.start();
    this.loops.set(id, { src, gain });
  }

  stopLoop(id: string): void {
    const l = this.loops.get(id);
    if (!l) return;
    try { l.src.stop(); l.src.disconnect(); l.gain.disconnect(); } catch { /* ignore */ }
    this.loops.delete(id);
  }

  stopAll(): void {
    for (const [, l] of this.loops) {
      try { l.src.stop(); l.src.disconnect(); l.gain.disconnect(); } catch { /* ignore */ }
    }
    this.loops.clear();
  }
}
