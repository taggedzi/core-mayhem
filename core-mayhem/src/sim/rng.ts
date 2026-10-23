// Match-owned gameplay randomness. Cosmetic draws (avatar jitter, announcer
// picks, starfield) keep their own generators so extra frames do not change combat.

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return (): number => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

let nextRandom = mulberry32(1);

/** Start a new gameplay stream. The same seed replays the same choices. */
export function resetGameplayRng(seed: number): void {
  nextRandom = mulberry32(seed >>> 0);
}

/** Uniform value in [0, 1). */
export function gameplayRandom(): number {
  return nextRandom();
}

/** Replace the stream for a test. Call the returned function to restore it. */
export function useGameplayRandom(next: () => number): () => void {
  const previous = nextRandom;
  nextRandom = next;
  return (): void => {
    nextRandom = previous;
  };
}
