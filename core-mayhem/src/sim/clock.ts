// Wall time for live play. Batch replays swap in a fixed clock so cooldowns,
// spawns, and shot delays follow simulation steps instead of frame timing.

let fixed = false;
let now = 0;

export function isFixedSimClock(): boolean {
  return fixed;
}

export function simNowMs(): number {
  return fixed ? now : performance.now();
}

/** Enable or disable the fixed clock. Enabling restarts it at 0. */
export function setFixedSimClock(enabled: boolean): void {
  fixed = enabled;
  now = 0;
}

export function advanceFixedSimClock(dtMs: number): void {
  if (!fixed) return;
  now += dtMs;
}
