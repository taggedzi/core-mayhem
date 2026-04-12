import { sim } from '../state';

interface ScoreData {
  leftWins: number;
  rightWins: number;
  ties: number;
}

/** Pure: reads sim.stats and returns both numbers and the existing HTML. */
export function getScoreData(): ScoreData {
  const s = (sim as any).stats ?? { leftWins: 0, rightWins: 0, ties: 0 };
  const leftWins = s.leftWins | 0;
  const rightWins = s.rightWins | 0;
  const ties = s.ties | 0;

  return { leftWins, rightWins, ties };
}
