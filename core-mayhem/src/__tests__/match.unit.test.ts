import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock side-effectful modules used by match.ts
vi.mock('../announcer', () => ({
  announcer: {
    trigger: vi.fn(),
    run: vi.fn(),
  },
}));
vi.mock('../render/score', () => ({
  updateScoreboard: vi.fn(),
}));
vi.mock('../app/speakBanterLLM', () => ({
  speakBanterSmart: vi.fn(async () => {}),
}));
vi.mock('../app/stats', () => ({
  recordMatchEnd: vi.fn(() => {}),
}));

import * as matchMod from '../app/systems/match';
import { declareWinner, maybeEndMatch, checkTimeLimit } from '../app/systems/match';
import { announcer } from '../announcer';
import { updateScoreboard } from '../render/score';
import { speakBanterSmart } from '../app/speakBanterLLM';
import { recordMatchEnd } from '../app/stats';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';
import { MATCH_LIMIT, GAMEOVER } from '../config';

describe('systems/match unit', () => {
  beforeEach(() => {
    // Fake timers and fixed time for determinism
    vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockReturnValue(10_000);
    // Reset global sim and counters
    resetSimState();
    (sim as any).stats = { leftWins: 0, rightWins: 0, ties: 0 };
    // Clear mocks
    vi.clearAllMocks();
    // Ensure no existing restart timer
    (sim as any).restartTO = 0;
  });

  it('declareWinner triggers announcer and updates flags', () => {
    declareWinner(SIDE.LEFT);
    expect((announcer.trigger as unknown as vi.Mock).mock.calls[0][0]).toBe('match_end_win');
    expect(announcer.run).toHaveBeenCalledTimes(1);
    expect((sim as any).gameOver).toBe(true);
    expect((sim as any).winner).toBe(SIDE.LEFT);
    expect(typeof (sim as any).winnerAt).toBe('number');
  });

  it('declareWinner(tie) uses generic announcer line', () => {
    declareWinner(0);
    expect((announcer.trigger as unknown as vi.Mock).mock.calls[0][0]).toBe('match_end_generic');
    expect((sim as any).winner).toBe(0);
  });

  it('increments stats and calls updateScoreboard + recordMatchEnd', () => {
    declareWinner(SIDE.RIGHT);
    expect((sim as any).stats.rightWins).toBe(1);
    expect((sim as any).stats.leftWins).toBe(0);
    expect((sim as any).stats.ties).toBe(0);
    expect(updateScoreboard).toHaveBeenCalledTimes(1);
    expect(recordMatchEnd).toHaveBeenCalledTimes(1);
  });

  it('triggers victory banter for the winning side only', () => {
    declareWinner(SIDE.LEFT);
    expect((speakBanterSmart as unknown as vi.Mock).mock.calls[0][0]).toBe('victory');
    expect((speakBanterSmart as unknown as vi.Mock).mock.calls[0][1]).toBe('L');
    vi.clearAllMocks();
    declareWinner(0);
    expect(speakBanterSmart).not.toHaveBeenCalled();
  });

  it('tournament bookkeeping: initializes scores, awards points, and advances index', () => {
    // Enable tournament mode
    localStorage.setItem('cm_game_mode', 'tournament');
    (sim as any).tournament = { pairs: [['A', 'B']], index: 2 };
    (sim as any).matchPersonaL = 'A';
    (sim as any).matchPersonaR = 'B';

    declareWinner(SIDE.RIGHT);
    const T = (sim as any).tournament;
    expect(T.scores).toBeTruthy();
    expect(T.scores['A']).toBe(0);
    expect(T.scores['B']).toBe(1);
    expect(T.index).toBe(3); // advanced by 1
  });

  it('tournament tie: no points but advances index', () => {
    localStorage.setItem('cm_game_mode', 'tournament');
    (sim as any).tournament = { pairs: [['A', 'B']], index: 0 };
    (sim as any).matchPersonaL = 'A';
    (sim as any).matchPersonaR = 'B';
    declareWinner(0);
    const T = (sim as any).tournament;
    expect(T.scores['A']).toBe(0);
    expect(T.scores['B']).toBe(0);
    expect(T.index).toBe(1);
  });

  it('auto-restart schedules a restart event after banner delay', () => {
    // Sanity: config enables autoRestart by default
    expect(GAMEOVER.autoRestart).toBe(true);
    let fired = 0;
    window.addEventListener('coreMayhem:restart', () => { fired++; });
    // Intercept setTimeout to avoid advancing unrelated timers from other tests
    let scheduled: (() => void) | null = null;
    const spyTO = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((cb: TimerHandler, _ms?: number | undefined) => {
        if (typeof cb === 'function') scheduled = cb as any;
        return 111 as unknown as number;
      }) as any);
    declareWinner(SIDE.LEFT);
    expect(spyTO).toHaveBeenCalled();
    // Expect delay argument equals bannerMs
    const call = (spyTO as unknown as vi.Mock).mock.calls[0];
    expect(call[1]).toBe(GAMEOVER.bannerMs);
    // Manually fire the scheduled callback
    expect(typeof scheduled).toBe('function');
    scheduled && scheduled();
    expect(fired).toBe(1);
    expect((sim as any).restartTO).toBe(0);
    spyTO.mockRestore();
  });

  it('does not schedule auto-restart if a timer already exists', () => {
    (sim as any).restartTO = 1234; // pretend existing timer
    declareWinner(SIDE.RIGHT);
    // Since we set a fake handle, the code should not overwrite it
    expect((sim as any).restartTO).toBe(1234);
  });

  it('maybeEndMatch declares tie when both cores are dead', () => {
    (sim as any).coreL = { centerHP: 0 };
    (sim as any).coreR = { centerHP: 0 };
    maybeEndMatch();
    expect((sim as any).gameOver).toBe(true);
    expect((sim as any).winner).toBe(0);
  });

  it('maybeEndMatch is a no-op when already gameOver', () => {
    (sim as any).gameOver = true;
    const spy = vi.spyOn(matchMod, 'declareWinner');
    maybeEndMatch();
    expect(spy).not.toHaveBeenCalled();
  });

  it('checkTimeLimit declares tie only when elapsed >= limit', () => {
    // Not yet elapsed
    const now = 50_000;
    (performance.now as any).mockReturnValue(now);
    (sim as any).matchStart = now - (MATCH_LIMIT.ms - 500);
    checkTimeLimit();
    expect((sim as any).gameOver).toBe(false);
    // Elapsed
    (sim as any).matchStart = now - (MATCH_LIMIT.ms + 1);
    checkTimeLimit();
    expect((sim as any).gameOver).toBe(true);
    expect((sim as any).winner).toBe(0);
  });
});
