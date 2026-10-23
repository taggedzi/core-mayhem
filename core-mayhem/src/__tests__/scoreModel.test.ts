import { describe, it, expect, beforeEach } from 'vitest';

import { recordMatchEnd, resetStats, startNewMatch } from '../app/stats';
import { getScoreData } from '../render/scoreModel';
import { sim } from '../state';
import { SIDE } from '../types';

describe('getScoreData', () => {
  beforeEach(() => {
    resetStats();
  });

  it('reads declared match results rather than a separate counter', () => {
    const finish = (winner: number): void => {
      startNewMatch();
      (sim as any).winner = winner;
      (sim as any).winnerAt = 1_000;
      recordMatchEnd();
    };
    finish(SIDE.LEFT);
    finish(SIDE.LEFT);
    finish(SIDE.LEFT);
    finish(SIDE.RIGHT);
    finish(0);
    finish(0);

    expect((sim as any).stats).toEqual({ leftWins: 3, rightWins: 1, ties: 2 });
    (sim as any).stats = { leftWins: 9, rightWins: 9, ties: 9 };
    expect(getScoreData()).toEqual({ leftWins: 3, rightWins: 1, ties: 2 });
  });
});
