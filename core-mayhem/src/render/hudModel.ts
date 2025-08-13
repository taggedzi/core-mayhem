// src/render/hudModel.ts
import { sim } from '../state';

const i = (x: number): number => Math.max(0, Math.round(x));

export interface HudData {
  leftHp: string; // e.g. "50|Σ120"
  rightHp: string; // e.g. "48|Σ110"
  state: string; // "Running" | "Idle" | "Game Over"
}

/** Pure: reads sim, returns plain strings for the HUD (no DOM). */
export function getHudData(): HudData {
  const lCenter = i(sim.coreL?.centerHP ?? 0);
  const rCenter = i(sim.coreR?.centerHP ?? 0);
  const lSegSum = i((sim.coreL?.segHP ?? []).reduce((a, b) => a + Math.max(0, b), 0));
  const rSegSum = i((sim.coreR?.segHP ?? []).reduce((a, b) => a + Math.max(0, b), 0));

  let state = sim.started ? 'Running' : 'Idle';
  if (sim.coreL && sim.coreR && (sim.coreL.centerHP <= 0 || sim.coreR.centerHP <= 0)) {
    state = 'Game Over';
  }

  return {
    leftHp: `${lCenter}|Σ${lSegSum}`,
    rightHp: `${rCenter}|Σ${rSegSum}`,
    state,
  };
}
