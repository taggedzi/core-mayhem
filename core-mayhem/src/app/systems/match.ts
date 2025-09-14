import { announcer } from '../../announcer';
import { GAMEOVER, MATCH_LIMIT } from '../../config';
import { updateScoreboard } from '../../render/score';
import { sim } from '../../state';
import { SIDE, type Side } from '../../types';
import { speakBanterSmart } from '../speakBanterLLM';
import { recordMatchEnd } from '../stats';
// setBanter handled via speakBanterSmart

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

  // Banter: winner speaks a victory line (LLM with fallback)
  try {
    if (winner === SIDE.LEFT) void speakBanterSmart('victory' as any, 'L');
    else if (winner === SIDE.RIGHT) void speakBanterSmart('victory' as any, 'R');
  } catch { /* ignore */ }

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

  // Tournament bookkeeping: advance pairing and record winner
  try {
    const mode = (() => { try { return ((localStorage.getItem('cm_game_mode') as any) ?? 'manual'); } catch { return 'manual'; } })() as 'manual' | 'random' | 'tournament';
    if (mode === 'tournament') {
      const T = (sim as any).tournament as any;
      if (T && Array.isArray(T.pairs)) {
        const kL = (sim as any).matchPersonaL as string | null;
        const kR = (sim as any).matchPersonaR as string | null;
        // Initialize scores map if missing
        if (!T.scores) {
          T.scores = {};
          if (kL) T.scores[kL] = 0;
          if (kR) T.scores[kR] = 0;
        }
        if (winner === SIDE.LEFT && kL) T.scores[kL] = (T.scores[kL] | 0) + 1;
        else if (winner === SIDE.RIGHT && kR) T.scores[kR] = (T.scores[kR] | 0) + 1;
        else if (winner === 0) { /* tie: no points */ }
        // Advance to next pairing
        if (typeof T.index === 'number') T.index = Math.max(0, (T.index | 0) + 1);
      }
    }
  } catch {
    // ignore tournament errors
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

