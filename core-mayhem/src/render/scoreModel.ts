import { getSummary, initStats } from '../app/stats';

interface ScoreData {
  leftWins: number;
  rightWins: number;
  ties: number;
}

/** Header score. Uses the same declared match results as the Stats panel. */
export function getScoreData(): ScoreData {
  initStats();
  const { leftWins, rightWins, ties } = getSummary();
  return { leftWins, rightWins, ties };
}
