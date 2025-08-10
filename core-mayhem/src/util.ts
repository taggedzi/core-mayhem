// Tiny seeded RNG
export function RNG(seed: number) {
  let s = seed >>> 0;
  const next = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000;
  return {
    next,
    int: (a: number, b: number) => a + Math.floor(next() * (b - a + 1)),
    pick: <T>(arr: T[]) => arr[Math.floor(next() * arr.length)],
  };
}
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
