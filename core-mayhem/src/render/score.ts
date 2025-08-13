import { getScoreData } from './scoreModel';

export function updateScoreboard(): void {
  const el = document.getElementById('score');
  if (!el) return;
  const data = getScoreData();
  el.innerHTML = data.html;
}
