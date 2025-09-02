import { sim } from '../../state';

export function runFXPrune(now = performance.now()): void {
  // wind-up rings
  (sim as any).fxArm = ((sim as any).fxArm ?? []).filter((fx: any) => (fx?.until ?? 0) > now);

  // modern laser beams and bursts
  (sim as any).fxBeams = ((sim as any).fxBeams ?? []).filter((b: any) => (b?.tEnd ?? 0) > now);
  (sim as any).fxBursts = ((sim as any).fxBursts ?? []).filter((b: any) => (b?.tEnd ?? 0) > now);

  // legacy fx lists kept for compatibility
  (sim as any).fxBeam = ((sim as any).fxBeam ?? []).filter((b: any) => now - (b?.t0 ?? 0) < (b?.ms ?? 0));
  (sim as any).fxImp = ((sim as any).fxImp ?? []).filter((f: any) => now - (f?.t0 ?? 0) < (f?.ms ?? 0));
  (sim as any).fxSweep = ((sim as any).fxSweep ?? []).filter((s: any) => now - (s?.t0 ?? 0) < (s?.ms ?? 0));
  (sim as any).fxSparks = ((sim as any).fxSparks ?? []).filter((p: any) => now - (p?.t0 ?? 0) < (p?.ms ?? 0));
}
