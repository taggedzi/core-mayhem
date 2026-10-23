import { describe, it, expect, beforeEach, vi } from 'vitest';

import { getSummary, resetStats, startNewMatch } from '../app/stats';
import { declareWinner, maybeEndMatch, checkTimeLimit } from '../app/systems/match';
import { getScoreData } from '../render/scoreModel';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

describe('match flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStats();
    resetSimState();
    (sim as any).matchStart = performance.now();
    startNewMatch();
  });

  it('declareWinner updates stats and flags', () => {
    declareWinner(SIDE.LEFT);
    expect((sim as any).gameOver).toBe(true);
    expect((sim as any).winner).toBe(SIDE.LEFT);
    expect(getSummary()).toMatchObject({ leftWins: 1, rightWins: 0, ties: 0 });
    expect((sim as any).stats).toEqual({ leftWins: 1, rightWins: 0, ties: 0 });
    expect(getScoreData()).toEqual({ leftWins: 1, rightWins: 0, ties: 0 });
  });

  it('maybeEndMatch declares side when one core is dead', () => {
    (sim as any).coreL = { centerHP: 0 };
    (sim as any).coreR = { centerHP: 100 };
    maybeEndMatch();
    expect((sim as any).gameOver).toBe(true);
    expect((sim as any).winner).toBe(SIDE.RIGHT);
  });

  it('checkTimeLimit ties on timeout', () => {
    (sim as any).matchStart = performance.now() - 31 * 60 * 1000;
    checkTimeLimit();
    expect((sim as any).gameOver).toBe(true);
    expect((sim as any).winner).toBe(0);
    expect(getSummary().ties).toBe(1);
    expect(getScoreData().ties).toBe(1);
  });
});
