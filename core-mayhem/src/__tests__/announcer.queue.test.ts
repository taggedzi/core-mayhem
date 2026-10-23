import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../audio', () => ({
  audio: {
    playUrl: vi.fn(async () => {}),
    stopAnnouncer: vi.fn(),
    duck: vi.fn(),
    duckSfx: vi.fn(),
    setAnnouncerVolume: vi.fn(),
  },
}));

import { AnnouncerService } from '../announcer';
import { CLIP_DURATION_MS, POOLS } from '../announcer/config';
import { audio } from '../audio';

let now = 0;
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const lastUrl = (): string => vi.mocked(audio.playUrl).mock.calls.at(-1)![0];

describe('announcer playback queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.mocked(audio.playUrl).mockResolvedValue();
  });

  it('plays the first event at startup and preserves intro, ready, go order', async () => {
    const service = new AnnouncerService();
    service.trigger('pre_game');
    service.trigger('match_start_ready');
    service.trigger('match_start_go');
    for (const pool of ['pre_game', 'ready', 'go'] as const) {
      service.run(now);
      await flush();
      expect(POOLS[pool]).toContain(lastUrl());
      now += CLIP_DURATION_MS[lastUrl()]! + 101;
    }
    expect(audio.playUrl).toHaveBeenCalledTimes(3);
  });

  it('waits for loading and the full clip duration before starting another line', async () => {
    let finishLoad!: () => void;
    vi.mocked(audio.playUrl).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishLoad = resolve;
        }),
    );
    const service = new AnnouncerService();
    service.trigger('pre_game');
    service.trigger('match_start_ready');
    service.run(now);
    now = 500;
    service.run(now);
    expect(audio.playUrl).toHaveBeenCalledTimes(1);
    finishLoad();
    await flush();
    now += CLIP_DURATION_MS[lastUrl()]! - 1;
    service.run(now);
    expect(audio.playUrl).toHaveBeenCalledTimes(1);
    now += 102;
    service.run(now);
    expect(audio.playUrl).toHaveBeenCalledTimes(2);
  });

  it('interrupts for a match ending and discards queued combat/startup lines', async () => {
    const service = new AnnouncerService();
    service.trigger('pre_game');
    service.trigger('match_start_ready');
    service.run(now);
    await flush();
    now = 200;
    service.trigger('high_damage');
    service.trigger('match_end_win', { urgent: true });
    service.run(now);
    await flush();
    expect(audio.stopAnnouncer).toHaveBeenCalledTimes(1);
    expect(POOLS.match_end_win).toContain(lastUrl());
    now = 10000;
    service.run(now);
    expect(audio.playUrl).toHaveBeenCalledTimes(2);
  });

  it('replaces older countdowns, bypasses chatter spacing, and drops stale timers', async () => {
    const service = new AnnouncerService();
    service.trigger('high_damage');
    service.run(now);
    await flush();
    now = 2000;
    service.trigger('time_countdown_10');
    service.trigger('time_countdown_3');
    service.run(now);
    await flush();
    expect(POOLS.time_countdown_3).toContain(lastUrl());
    const other = new AnnouncerService();
    other.trigger('time_countdown_3');
    now += 1000;
    other.run(now);
    expect(audio.playUrl).toHaveBeenCalledTimes(2);
  });

  it('clears per-match cooldowns and cancels pending audio when disabled', async () => {
    const service = new AnnouncerService();
    service.trigger('match_start_go');
    service.run(now);
    await flush();
    service.setEnabled(false);
    now += 10;
    service.setEnabled(true);
    service.trigger('match_start_go');
    service.run(now);
    expect(audio.playUrl).toHaveBeenCalledTimes(2);
  });

  it('recovers after an audio load failure', async () => {
    vi.mocked(audio.playUrl).mockRejectedValueOnce(new Error('load failed'));
    const service = new AnnouncerService();
    service.trigger('pre_game');
    service.trigger('match_start_ready');
    service.run(now);
    await flush();
    service.run(now);
    expect(audio.playUrl).toHaveBeenCalledTimes(2);
  });
});
