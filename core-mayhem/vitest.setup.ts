// Polyfill ResizeObserver (no-ops for tests)
class RO {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as any).ResizeObserver = RO;

// rAF/cAF fallback
if (!(globalThis as any).requestAnimationFrame) {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
}
if (!(globalThis as any).cancelAnimationFrame) {
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as number);
}
