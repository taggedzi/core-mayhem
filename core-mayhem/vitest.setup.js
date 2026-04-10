"use strict";
// Polyfill ResizeObserver (no-ops for tests)
class RO {
    observe() { }
    unobserve() { }
    disconnect() { }
}
globalThis.ResizeObserver = RO;
// rAF/cAF fallback
if (!globalThis.requestAnimationFrame) {
    globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
}
if (!globalThis.cancelAnimationFrame) {
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
