import { getScoreData } from './scoreModel';

// P2: build the scoreboard DOM once, then update only the number spans via
// textContent instead of reparsing innerHTML on every score change.
let scoreContainer: HTMLElement | null = null;
let leftWinsSpan: HTMLSpanElement | null = null;
let tiesSpan: HTMLSpanElement | null = null;
let rightWinsSpan: HTMLSpanElement | null = null;

function buildScoreboard(container: HTMLElement): void {
  const leftTag = document.createElement('span');
  leftTag.className = 'left tag';
  leftTag.textContent = 'LEFT';

  leftWinsSpan = document.createElement('span');

  const sep1 = document.createElement('span');
  sep1.className = 'sep';
  sep1.textContent = '|';

  tiesSpan = document.createElement('span');

  const sep2 = document.createElement('span');
  sep2.className = 'sep';
  sep2.textContent = '|';

  const rightTag = document.createElement('span');
  rightTag.className = 'right tag';
  rightTag.textContent = 'RIGHT';

  rightWinsSpan = document.createElement('span');

  container.append(leftTag, leftWinsSpan, sep1, tiesSpan, sep2, rightTag, rightWinsSpan);
}

export function updateScoreboard(): void {
  scoreContainer ??= document.getElementById('score');
  if (!scoreContainer) return;
  if (!leftWinsSpan) buildScoreboard(scoreContainer);
  const { leftWins, ties, rightWins } = getScoreData();
  leftWinsSpan!.textContent = ` ${leftWins} `;
  tiesSpan!.textContent = `T:${ties} `;
  rightWinsSpan!.textContent = ` ${rightWins}`;
}
