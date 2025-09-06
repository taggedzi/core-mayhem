import { describe, it, expect } from 'vitest';

import { runFXPrune } from '../app/systems/fx';
import { sim, resetSimState } from '../state';

describe('runFXPrune', () => {
  it('removes expired fx and keeps active ones', () => {
    resetSimState();
    const now = 1000;
    (sim as any).fxArm = [
      { until: now - 1, x: 0, y: 0, color: 'x' },
      { until: now + 10, x: 0, y: 0, color: 'y' },
    ];
    (sim as any).fxBeams = [
      { tEnd: now - 1 },
      { tEnd: now + 1 },
    ];
    (sim as any).fxBursts = [
      { tEnd: now - 1 },
      { tEnd: now + 1 },
    ];
    (sim as any).fxBeam = [
      { t0: now - 100, ms: 50 },
      { t0: now - 10, ms: 50 },
    ];
    (sim as any).fxImp = [
      { t0: now - 100, ms: 50 },
      { t0: now - 10, ms: 50 },
    ];
    (sim as any).fxSweep = [
      { t0: now - 100, ms: 50 },
      { t0: now - 10, ms: 50 },
    ];
    (sim as any).fxSparks = [
      { t0: now - 100, ms: 50 },
      { t0: now - 10, ms: 50 },
    ];
    (sim as any).fxBanners = [
      { t0: now - 100, ms: 50 },
      { t0: now - 10, ms: 50 },
    ];

    runFXPrune(now);

    expect(sim.fxArm.length).toBe(1);
    expect(sim.fxBeams!.length).toBe(1);
    expect(sim.fxBursts!.length).toBe(1);
    expect(sim.fxBeam.length).toBe(1);
    expect(sim.fxImp.length).toBe(1);
    expect(sim.fxSweep.length).toBe(1);
    expect(sim.fxSparks!.length).toBe(1);
    expect(((sim as any).fxBanners ?? []).length).toBe(1);
  });

  it('handles missing arrays gracefully (no throws)', () => {
    resetSimState();
    // do not set any fx arrays
    expect(() => runFXPrune(100)).not.toThrow();
  });
});
