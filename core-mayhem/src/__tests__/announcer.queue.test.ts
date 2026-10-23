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

import { AnnouncerService, announcerControls } from '../announcer';
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

  it('updates settings through the public controls and ignores absent updates', () => {
    announcerControls.updateSettings({ announcerVolume: 0.4, minGapMs: 123 });
    expect(announcerControls.getSettings()).toMatchObject({ announcerVolume: 0.4, minGapMs: 123 });
    expect(audio.setAnnouncerVolume).toHaveBeenCalledWith(0.4);
    announcerControls.updateSettings(null as any);
    announcerControls.setEnabled(false);
    expect(audio.stopAnnouncer).toHaveBeenCalledOnce();
    announcerControls.setEnabled(true);
  });

  it('ignores disabled and unknown events and drops expired countdowns', () => {
    const service = new AnnouncerService();
    service.setEnabled(false);
    service.trigger('pre_game');
    service.run();
    service.setEnabled(true);
    service.trigger('unknown' as any);
    service.trigger('time_countdown_10');
    now = 1600;
    service.run();
    expect(audio.playUrl).not.toHaveBeenCalled();
  });

  it('avoids an immediate repeat and respects combat chatter spacing', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const service = new AnnouncerService();
    service.updateSettings({ minGapMs: 10000 });
    service.trigger('high_damage');
    service.run();
    await flush();
    const first = lastUrl();
    now = 3000;
    service.trigger('high_damage', { priorityBoost: 5 });
    service.run();
    expect(audio.playUrl).toHaveBeenCalledOnce();
    now = 11000;
    service.trigger('high_damage', { urgent: true });
    service.run();
    await flush();
    expect(lastUrl()).not.toBe(first);
  });

  it('ignores completion of audio interrupted during loading', async () => {
    let finish!: () => void;
    vi.mocked(audio.playUrl).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const service = new AnnouncerService();
    service.trigger('pre_game');
    service.run();
    service.reset();
    finish();
    await flush();
    service.trigger('match_start_go');
    service.run();
    expect(audio.playUrl).toHaveBeenCalledTimes(2);
  });
});
