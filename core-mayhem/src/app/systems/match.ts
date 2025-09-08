import { GAMEOVER, MATCH_LIMIT } from '../../config';
import { updateScoreboard } from '../../render/score';
import { sim } from '../../state';
import { SIDE, type Side } from '../../types';
import { recordMatchEnd } from '../stats';
import { announcer } from '../../announcer';

function isDead(core: any): boolean {
  return (core?.centerHP | 0) <= 0;
}

export function declareWinner(winner: Side | 0): void {
  // Announcer first: play end-of-match VO immediately so it starts before the banner shows
  try {
    const ev = winner === 0 ? 'match_end_generic' : 'match_end_win';
    announcer.trigger(ev as any, { urgent: true, priorityBoost: 2 });
    announcer.run(performance.now());
  } catch {
    // ignore announcer errors
  }
  (sim as any).winner = winner; // 0 = tie
  (sim as any).gameOver = true;
  (sim as any).winnerAt = performance.now();

  const stats = (sim as any).stats ?? ((sim as any).stats = { leftWins: 0, rightWins: 0, ties: 0 });
  if (winner === SIDE.LEFT) stats.leftWins++;
  else if (winner === SIDE.RIGHT) stats.rightWins++;
  else stats.ties++;

  updateScoreboard();

  // Record match summary into stats
  try {
    recordMatchEnd();
  } catch {
    // ignore stats errors
  }

  // (announcer already triggered at the start)

  if (GAMEOVER.autoRestart && !(sim as any).restartTO) {
    (sim as any).restartTO = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('coreMayhem:restart'));
      (sim as any).restartTO = 0;
    }, GAMEOVER.bannerMs);
  }
}

export function maybeEndMatch(): void {
  if ((sim as any).gameOver) return;
  const deadL = isDead((sim as any).coreL);
  const deadR = isDead((sim as any).coreR);
  if (!deadL && !deadR) return;
  declareWinner(deadL && deadR ? 0 : deadL ? SIDE.RIGHT : SIDE.LEFT);
}

export function checkTimeLimit(): void {
  if (!MATCH_LIMIT.enabled || MATCH_LIMIT.ms <= 0 || (sim as any).gameOver) return;
  const start = (sim as any).matchStart ?? 0;
  const elapsed = performance.now() - start;
  if (elapsed >= MATCH_LIMIT.ms) {
    declareWinner(0);
  }
}

