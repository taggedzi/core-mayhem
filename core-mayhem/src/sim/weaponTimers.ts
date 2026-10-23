import { isFixedSimClock, simNowMs } from './clock';

// Each match boundary invalidates pending windups and every nested burst shot.
const timers = new Set<ReturnType<typeof setTimeout>>();
let generation = 0;

interface QueuedShot {
  at: number;
  owner: number;
  callback: () => void;
  active: () => boolean;
}

const queued: QueuedShot[] = [];

export function cancelWeaponTimers(): void {
  generation++;
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  queued.length = 0;
}

export function scheduleWeaponShot(
  callback: () => void,
  delay: number,
  active: () => boolean,
): void {
  const owner = generation;
  if (isFixedSimClock()) {
    queued.push({ at: simNowMs() + delay, owner, callback, active });
    return;
  }
  const timer = setTimeout(() => {
    timers.delete(timer);
    if (owner === generation && active()) callback();
  }, delay);
  timers.add(timer);
}

/** Fire shots whose sim-clock delay has elapsed. No-op while the wall clock is in use. */
export function flushWeaponShots(now = simNowMs()): void {
  if (!isFixedSimClock() || queued.length === 0) return;
  const due: QueuedShot[] = [];
  const waiting: QueuedShot[] = [];
  for (const shot of queued) {
    if (shot.owner !== generation) continue;
    if (shot.at <= now) due.push(shot);
    else waiting.push(shot);
  }
  queued.length = 0;
  queued.push(...waiting);
  for (const shot of due) {
    if (shot.owner === generation && shot.active()) shot.callback();
  }
}
