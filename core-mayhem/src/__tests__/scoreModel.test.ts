import { describe, it, expect } from 'vitest';

import { getScoreData } from '../render/scoreModel';
import { sim } from '../state';

describe('getScoreData (pure)', () => {
  it('computes wins correctly', () => {
    (sim as any).stats = { leftWins: 3, rightWins: 1, ties: 2 };
    const data = getScoreData();

    expect(data.leftWins).toBe(3);
    expect(data.rightWins).toBe(1);
    expect(data.ties).toBe(2);
  });
});
