import { audio } from '../audio';

import {
  ANNOUNCER_AUDIO,
  CLIP_DURATION_MS,
  EVENTS,
  POOLS,
  RECORDED_ANNOUNCER_AVAILABLE,
  type AnnounceEvent,
} from './config';

type PoolId = keyof typeof POOLS;

interface QueueItem {
  event: AnnounceEvent;
  pools: readonly PoolId[];
  priority: number;
  at: number;
}

const START_EVENTS = new Set<AnnounceEvent>(['pre_game', 'match_start_ready', 'match_start_go']);

const rnd = (n: number): number => Math.floor(Math.random() * n);

export class AnnouncerService {
  private lastAt = -Infinity;
  private busyUntil = 0;
  private pending = false;
  private generation = 0;
  private lastEventAt = new Map<AnnounceEvent, number>();
  private recentByPool = new Map<PoolId, string>();
  private q: QueueItem[] = [];
  private forceNext = false;
  private enabled: boolean = RECORDED_ANNOUNCER_AVAILABLE;
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
    const lastEv = this.lastEventAt.get(ev);
    if (lastEv !== undefined && now - lastEv < (spec.cooldownMs ?? 0)) return;
    this.lastEventAt.set(ev, now);
    const isStart = START_EVENTS.has(ev);
    const isTimer = ev.startsWith('time_countdown_');
    const prio = isStart
      ? 20
      : isTimer
        ? 30
        : (spec.priority | 0) + ((opts?.priorityBoost ?? 0) | 0);
    if (isTimer) this.q = this.q.filter((item) => !item.event.startsWith('time_countdown_'));
    // Urgent: stop current announcer and allow immediate playback
    if (opts?.urgent) {
      this.interrupt();
      this.q.length = 0;
      this.forceNext = true;
    }
    this.q.push({ event: ev, pools: spec.pools, priority: prio, at: now });
    // sort by priority desc then time asc
    this.q.sort((a, b) => b.priority - a.priority || a.at - b.at);
  }

  // Expire stale commentary, preserve startup order, and never overlap clips.
  run(now = performance.now()): void {
    if (!this.enabled) {
      this.q.length = 0;
      return;
    }
    this.q = this.q.filter(
      (item) =>
        now - item.at <=
        (item.event === 'time_countdown_3'
          ? 900
          : item.event === 'time_countdown_10'
            ? 1500
            : 4500),
    );
    if (this.pending || now < this.busyUntil || this.q.length === 0) return;
    const next = this.q[0]!;
    const timeSensitive = START_EVENTS.has(next.event) || next.event.startsWith('time_countdown_');
    if (!this.forceNext && !timeSensitive && now - this.lastAt < this.settings.minGapMs) return;
    const item = this.q.shift()!;
    const url = this.pickUrl(this.pickPool(item.pools));
    if (!url) return;
    const duration = CLIP_DURATION_MS[url] ?? 2000;
    const duckMs = duration + this.settings.duckReleaseMs;
    audio.duck(this.settings.duckMusic, duckMs);
    audio.duckSfx(this.settings.duckSfx, duckMs);
    const generation = this.generation;
    this.pending = true;
    this.forceNext = false;
    void Promise.resolve(
      audio.playUrl(url, { channel: 'announcer', volume: this.settings.announcerVolume }),
    )
      .then(() => {
        if (generation !== this.generation) return;
        this.lastAt = performance.now();
        this.busyUntil = this.lastAt + duration + 100;
      })
      .catch(() => {
        /* A failed clip must not stall subsequent announcements. */
      })
      .finally(() => {
        if (generation === this.generation) this.pending = false;
      });
  }

  private interrupt(): void {
    this.generation++;
    this.pending = false;
    this.busyUntil = 0;
    audio.stopAnnouncer();
  }

  reset(): void {
    this.interrupt();
    this.q.length = 0;
    this.lastEventAt.clear();
    this.recentByPool.clear();
    this.lastAt = -Infinity;
    this.forceNext = false;
  }

  setEnabled(on: boolean): void {
    this.enabled = on && RECORDED_ANNOUNCER_AVAILABLE;
    if (!this.enabled) this.reset();
  }
  updateSettings(p: Partial<typeof this.settings>): void {
    if (p == null) return;
    this.settings = { ...this.settings, ...p };
    if (typeof p.announcerVolume === 'number') {
      try {
        audio.setAnnouncerVolume(this.settings.announcerVolume);
      } catch {
        /* ignore */
      }
    }
  }
  getSettings(): Readonly<typeof this.settings> {
    return this.settings;
  }

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
  updateSettings: (
    p: Partial<{
      announcerVolume: number;
      duckMusic: number;
      duckSfx: number;
      duckReleaseMs: number;
      minGapMs: number;
    }>,
  ): void => announcer.updateSettings(p as any),
  getSettings: (): Readonly<{
    announcerVolume: number;
    duckMusic: number;
    duckSfx: number;
    duckReleaseMs: number;
    minGapMs: number;
  }> => announcer.getSettings() as any,
};
