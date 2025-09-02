import { describe, it, expect, beforeEach, vi } from 'vitest';

import { declareWinner, maybeEndMatch, checkTimeLimit } from '../app/systems/match';
import { sim, resetSimState } from '../state';
import { SIDE } from '../types';

describe('match flow', () => {
  beforeEach(() => {
    resetSimState();
    (sim as any).stats = { leftWins: 0, rightWins: 0, ties: 0 };
    (sim as any).matchStart = performance.now();
    vi.useFakeTimers();
  });

  it('declareWinner updates stats and flags', () => {
    declareWinner(SIDE.LEFT);
    expect((sim as any).gameOver).toBe(true);
    expect((sim as any).winner).toBe(SIDE.LEFT);
    expect((sim as any).stats.leftWins).toBe(1);
    expect((sim as any).stats.rightWins).toBe(0);
    expect((sim as any).stats.ties).toBe(0);
  });

  it('maybeEndMatch declares side when one core is dead', () => {
    (sim as any).coreL = { centerHP: 0 };
    (sim as any).coreR = { centerHP: 100 };
    maybeEndMatch();
    expect((sim as any).gameOver).toBe(true);
    expect((sim as any).winner).toBe(SIDE.RIGHT);
  });

  it('checkTimeLimit ties on timeout', () => {
    (sim as any).matchStart = performance.now() - (31 * 60 * 1000);
    checkTimeLimit();
    expect((sim as any).gameOver).toBe(true);
    expect((sim as any).winner).toBe(0);
  });
});

