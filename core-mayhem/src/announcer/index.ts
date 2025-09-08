import { audio } from '../audio';
import { ANNOUNCER_AUDIO, EVENTS, POOLS, type AnnounceEvent } from './config';

type PoolId = keyof typeof POOLS;

interface QueueItem {
  event: AnnounceEvent;
  pools: readonly PoolId[];
  priority: number;
  at: number;
}

const rnd = (n: number): number => Math.floor(Math.random() * n);

class AnnouncerService {
  private lastAt = 0;
  private lastEventAt = new Map<AnnounceEvent, number>();
  private recentByPool = new Map<PoolId, string>();
  private q: QueueItem[] = [];
  private forceNext = false;
  private enabled = true;
  private settings = { ...ANNOUNCER_AUDIO } as {
    announcerVolume: number;
    duckMusic: number;
    duckSfx: number;
    duckReleaseMs: number;
    minGapMs: number;
  };

  // enqueue an event respecting per-event cooldowns; high priority floats to front
  trigger(ev: AnnounceEvent, opts?: { urgent?: boolean; priorityBoost?: number }): void {
    if (!this.enabled) return;
    const spec = EVENTS[ev];
    if (!spec) return;
    const now = performance.now();
    const lastEv = this.lastEventAt.get(ev) || 0;
    if ((spec.cooldownMs ?? 0) > 0 && now - lastEv < (spec.cooldownMs as number)) return;
    this.lastEventAt.set(ev, now);
    const prio = (spec.priority | 0) + ((opts?.priorityBoost ?? 0) | 0);
    // Urgent: stop current announcer and allow immediate playback
    if (opts?.urgent) {
      try { audio.stopAnnouncer(); } catch { /* ignore */ }
      this.forceNext = true;
    }
    this.q.push({ event: ev, pools: spec.pools, priority: prio, at: now });
    // sort by priority desc then time asc
    this.q.sort((a, b) => (b.priority - a.priority) || (a.at - b.at));
  }

  // call each frame; plays next line if global gap elapsed
  run(now = performance.now()): void {
    if (!this.enabled) { this.q.length = 0; return; }
    if (this.q.length === 0) return;
    if (!this.forceNext && (now - this.lastAt < this.settings.minGapMs)) return;
    const item = this.q.shift()!;
    const pool = this.pickPool(item.pools);
    const url = this.pickUrl(pool);
    if (!url) return;
    // duck both music and sfx around VO; recover after config release
    try { audio.duck(this.settings.duckMusic, this.settings.duckReleaseMs); } catch { /* ignore */ }
    try { audio.duckSfx(this.settings.duckSfx, this.settings.duckReleaseMs); } catch { /* ignore */ }
    try { audio.playUrl(url, { channel: 'announcer', volume: this.settings.announcerVolume }); } catch { /* ignore */ }
    this.lastAt = now;
    this.forceNext = false;
  }

  setEnabled(on: boolean): void { this.enabled = !!on; if (!on) try { audio.stopAnnouncer(); } catch { /* ignore */ } }
  updateSettings(p: Partial<typeof this.settings>): void {
    if (p == null) return;
    this.settings = { ...this.settings, ...p };
    if (typeof p.announcerVolume === 'number') {
      try { audio.setAnnouncerVolume(this.settings.announcerVolume); } catch { /* ignore */ }
    }
  }
  getSettings(): Readonly<typeof this.settings> { return this.settings; }

  private pickPool(pools: readonly PoolId[]): PoolId {
    if (pools.length === 0) return Object.keys(POOLS)[0] as PoolId;
    if (pools.length === 1) return pools[0] as PoolId;
    return pools[rnd(pools.length)] as PoolId;
  }

  private pickUrl(pool: PoolId): string | null {
    const list = POOLS[pool] as readonly string[];
    if (!list || list.length === 0) return null;
    // avoid immediate repeat per pool
    const last = this.recentByPool.get(pool);
    let url = list[rnd(list.length)]!;
    if (list.length > 1 && url === last) {
      const idx = (list.indexOf(url) + 1) % list.length;
      url = list[idx]!;
    }
    this.recentByPool.set(pool, url);
    return url ?? null;
  }
}

export const announcer = new AnnouncerService();
export const announcerControls = {
  setEnabled: (on: boolean): void => announcer.setEnabled(on),
  updateSettings: (p: Partial<{ announcerVolume: number; duckMusic: number; duckSfx: number; duckReleaseMs: number; minGapMs: number }>): void => announcer.updateSettings(p as any),
  getSettings: (): Readonly<{ announcerVolume: number; duckMusic: number; duckSfx: number; duckReleaseMs: number; minGapMs: number }> => announcer.getSettings() as any,
};
