import { getHudData } from './hudModel';

// P1: cache element references so getElementById is not called every frame.
// Populated on first updateHUD() call; elements are static HTML so they are
// present from the moment the page is loaded.
let initialized = false;
let hpLEl: HTMLElement | null = null;
let hpREl: HTMLElement | null = null;
let stateElRef: HTMLElement | null = null;

function initElements(): void {
  hpLEl = document.getElementById('hpL');
  hpREl = document.getElementById('hpR');
  stateElRef = document.getElementById('state');
  initialized = true;
}

export function updateHUD(): void {
  if (!initialized) initElements();
  const hud = getHudData();
  if (hpLEl) hpLEl.textContent = hud.leftHp;
  if (hpREl) hpREl.textContent = hud.rightHp;
  if (stateElRef) stateElRef.textContent = hud.state;
}
