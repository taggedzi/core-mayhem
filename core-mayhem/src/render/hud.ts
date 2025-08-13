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

export function setState(text: string): void {
  const el = document.getElementById('state');
  if (el) el.textContent = text;
}

export function setButtons(running: boolean): void {
  const btnStart = document.getElementById('btnStart') as HTMLButtonElement | null;
  if (btnStart) btnStart.disabled = running;

  const btnStop = document.getElementById('btnStop') as HTMLButtonElement | null;
  if (btnStop) btnStop.disabled = !running;
}
