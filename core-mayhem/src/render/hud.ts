import { getHudData } from './hudModel';

export function updateHUD(): void {
  const hud = getHudData();

  const hpL = document.getElementById('hpL');
  if (hpL) hpL.textContent = hud.leftHp;

  const hpR = document.getElementById('hpR');
  if (hpR) hpR.textContent = hud.rightHp;

  const stateEl = document.getElementById('state');
  if (stateEl) stateEl.textContent = hud.state;
}
