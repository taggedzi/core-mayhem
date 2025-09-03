import { sim } from '../state';

interface ScoreData {
  leftWins: number;
  rightWins: number;
  ties: number;
  html: string; // keep the existing colored-tag markup
}

/** Pure: reads sim.stats and returns both numbers and the existing HTML. */
export function getScoreData(): ScoreData {
  const s = (sim as any).stats ?? { leftWins: 0, rightWins: 0, ties: 0 };
  const leftWins = s.leftWins | 0;
  const rightWins = s.rightWins | 0;
  const ties = s.ties | 0;

  const lLoss = rightWins;
  const rLoss = leftWins;

  const html = `
    <span class="left tag">LEFT</span> ${leftWins}–${lLoss}
    ${ties ? `<span class="sep">|</span> T:${ties} <span class="sep">|</span>` : `<span class="sep">|</span>`}
    <span class="right tag">RIGHT</span> ${rightWins}–${rLoss}
  `;

  return { leftWins, rightWins, ties, html };
}
