import { describe, it, expect } from 'vitest';

import { getScoreData } from '../render/scoreModel';
import { sim } from '../state';

describe('getScoreData (pure)', () => {
  it('computes wins and html correctly', () => {
    (sim as any).stats = { leftWins: 3, rightWins: 1, ties: 2 };
    const data = getScoreData();

    expect(data.leftWins).toBe(3);
    expect(data.rightWins).toBe(1);
    expect(data.ties).toBe(2);

    // Only wins per side + total ties displayed
    expect(data.html).toContain('LEFT</span> 3'); // left wins
    expect(data.html).toContain('RIGHT</span> 1'); // right wins
    expect(data.html).toContain('T:2'); // ties
  });
});
