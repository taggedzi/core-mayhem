import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../announcer', () => ({
  announcer: {
    trigger: vi.fn(),
    run: vi.fn(),
  },
}));
vi.mock('../app/speakBanterLLM', () => ({
  speakBanterSmart: vi.fn(async () => {}),
}));

import { sim } from '../state';
import { MATCH_LIMIT } from '../config';
import { announcer } from '../announcer';
import { speakBanterSmart } from '../app/speakBanterLLM';
import { resetAnnouncerState, runAnnouncer } from '../app/systems/announcer';

function seedMatch(coreL: Partial<any> = {}, coreR: Partial<any> = {}): void {
  (sim as any).matchIndex = ((sim as any).matchIndex | 0) + 1;
  (sim as any).gameOver = false;
  (sim as any).coreL = { centerHP: 1000, centerHPmax: 1000, ...coreL };
  (sim as any).coreR = { centerHP: 1000, centerHPmax: 1000, ...coreR };
}

describe('systems/announcer runAnnouncer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAnnouncerState();
    vi.spyOn(performance, 'now').mockReturnValue(1000);
  });

  it('on new match: triggers pre_game + ready + go and both sides greet', () => {
    seedMatch();
    runAnnouncer();
    const trig = (announcer.trigger as unknown as vi.Mock).mock.calls.map((c) => c[0]);
    expect(trig).toEqual(['pre_game', 'match_start_ready', 'match_start_go']);
    // Two greetings via speakBanterSmart (L and R)
    expect((speakBanterSmart as unknown as vi.Mock).mock.calls.length).toBe(2);
  });

  it('first core damage triggers first_core_damage and first_blood', () => {
    seedMatch();
    // prime prevCenter values
    runAnnouncer();
    // Now apply damage to R only
    (sim as any).coreR.centerHP -= 50;
    runAnnouncer();
    const trig = (announcer.trigger as unknown as vi.Mock).mock.calls.map((c) => c[0]);
    expect(trig).toContain('first_core_damage');
    // With damage only to R, code selects L for first blood
    const calls = (speakBanterSmart as unknown as vi.Mock).mock.calls;
    const fb = calls.find((c) => c[0] === 'first_blood');
    expect(fb?.[1]).toBe('L');
  });

  it('extreme per-tick swing triggers extreme_event and big_hit for L', () => {
    seedMatch();
    runAnnouncer(); // set prev snapshot
    // Apply large damage to R to exceed swingExtreme (81)
    (sim as any).coreR.centerHP -= 200;
    runAnnouncer();
    const trig = (announcer.trigger as unknown as vi.Mock).mock.calls.map((c) => c[0]);
    expect(trig).toContain('extreme_event');
    const bh = (speakBanterSmart as unknown as vi.Mock).mock.calls.find((c) => c[0] === 'big_hit');
    expect(bh?.[1]).toBe('L');
  });

  it('danger threshold triggers core_in_danger_* once per side', () => {
    seedMatch({ centerHP: 100, centerHPmax: 100 }, { centerHP: 100, centerHPmax: 100 });
    runAnnouncer();
    // Drop L to <= 15%
    (sim as any).coreL.centerHP = 14;
    runAnnouncer();
    let trig = (announcer.trigger as unknown as vi.Mock).mock.calls.map((c) => c[0]);
    expect(trig).toContain('core_in_danger_L');
    // Call again with still low: should not retrigger
    runAnnouncer();
    const count = (announcer.trigger as unknown as vi.Mock).mock.calls.filter((c) => c[0] === 'core_in_danger_L').length;
    expect(count).toBe(1);
  });

  it('momentum shift triggers with comeback banter on sign flip and window elapsed', () => {
    resetAnnouncerState();
    // Start with L ahead
    seedMatch({ centerHP: 900, centerHPmax: 1000 }, { centerHP: 500, centerHPmax: 1000 });
    runAnnouncer(); // establish lastAdvSign
    // Advance time beyond momentumWindowMs
    (performance.now as any).mockReturnValue(8000);
    // Flip advantage to R with magnitude >= threshold (20% of 1000 => 200)
    ;(sim as any).coreL.centerHP = 300; (sim as any).coreR.centerHP = 700;
    runAnnouncer();
    const trig = (announcer.trigger as unknown as vi.Mock).mock.calls.map((c) => c[0]);
    expect(trig).toContain('momentum_shift');
    const cb = (speakBanterSmart as unknown as vi.Mock).mock.calls.find((c) => c[0] === 'comeback');
    // sign < 0 => comeback for R
    expect(cb?.[1]).toBe('R');
  });

  it('countdown events at 10 and 3 seconds remaining when both alive', () => {
    resetAnnouncerState();
    seedMatch({ centerHP: 10 }, { centerHP: 10 });
    // Set matchStart so remainingSec ~ 9, then ~2
    const now0 = 100000;
    (performance.now as any).mockReturnValue(now0);
    (sim as any).matchStart = now0 - (MATCH_LIMIT.ms - 9000);
    runAnnouncer();
    (performance.now as any).mockReturnValue(now0 + 7000);
    (sim as any).matchStart = now0 - (MATCH_LIMIT.ms - 2000);
    runAnnouncer();
    const evs = (announcer.trigger as unknown as vi.Mock).mock.calls.map((c) => c[0]);
    expect(evs).toContain('time_countdown_10');
    expect(evs).toContain('time_countdown_3');
  });
});
