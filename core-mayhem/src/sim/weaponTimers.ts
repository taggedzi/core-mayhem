// Each match boundary invalidates pending windups and every nested burst shot.
const timers = new Set<ReturnType<typeof setTimeout>>();
let generation = 0;

export function cancelWeaponTimers(): void {
  generation++;
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
}

export function scheduleWeaponShot(
  callback: () => void,
  delay: number,
  active: () => boolean,
): void {
  const owner = generation;
  const timer = setTimeout(() => {
    timers.delete(timer);
    if (owner === generation && active()) callback();
  }, delay);
  timers.add(timer);
}
