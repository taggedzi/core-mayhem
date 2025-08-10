// src/sim/mods.ts
import { sim } from '../state';

export function currentDmgMul(): number {
  const m = (sim as any).mods;
  if (!m) return 1;
  return performance.now() < (m.dmgUntil || 0) ? m.dmgMul || 1 : 1;
}

export function isWeaponDisabled(kind: 'cannon' | 'laser' | 'missile' | 'mortar'): boolean {
  const m = (sim as any).mods;
  if (!m) return false;
  return performance.now() < (m.disableUntil || 0) && m.disabledType === kind;
}
