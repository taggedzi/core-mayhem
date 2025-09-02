import { sim } from '../../state';
// typed via sim fields; no direct type imports needed here

export function runFXPrune(now = performance.now()): void {
  // wind-up rings
  sim.fxArm = (sim.fxArm ?? []).filter((fx) => (fx?.until ?? 0) > now);

  // modern laser beams and bursts
  sim.fxBeams = (sim.fxBeams ?? []).filter((b) => (b?.tEnd ?? 0) > now);
  sim.fxBursts = (sim.fxBursts ?? []).filter((b) => (b?.tEnd ?? 0) > now);

  // legacy fx lists kept for compatibility
  sim.fxBeam = (sim.fxBeam ?? []).filter((b) => now - (b?.t0 ?? 0) < (b?.ms ?? 0));
  sim.fxImp = (sim.fxImp ?? []).filter((f) => now - (f?.t0 ?? 0) < (f?.ms ?? 0));
  sim.fxSweep = (sim.fxSweep ?? []).filter((s) => now - (s?.t0 ?? 0) < (s?.ms ?? 0));
  sim.fxSparks = (sim.fxSparks ?? []).filter((p) => now - (p?.t0 ?? 0) < (p?.ms ?? 0));
}
