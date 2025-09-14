"use strict";
/* eslint-env browser */
/* eslint-disable @typescript-eslint/no-empty-function */
// Polyfill ResizeObserver (no-ops for tests)
class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
}
/* eslint-enable @typescript-eslint/no-empty-function */
globalThis.ResizeObserver = RO;
// rAF/cAF fallback
if (!globalThis.requestAnimationFrame) {
    globalThis.requestAnimationFrame = (cb) => globalThis.setTimeout(() => cb(globalThis.performance.now()), 16);
}
if (!globalThis.cancelAnimationFrame) {
    globalThis.cancelAnimationFrame = (id) => globalThis.clearTimeout(id);
}
