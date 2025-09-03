import { MODS } from '../config';
import { sim } from '../state';
import { SIDE, type Side, type WeaponKind, type SideMods } from '../types';

function modsFor(side: Side): SideMods {
  return side === SIDE.LEFT ? sim.modsL : sim.modsR;
}

export function currentDmgMul(side: Side): number {
  const m = modsFor(side);
  return performance.now() < m.dmgUntil ? m.dmgMul : 1;
}

export function isDisabled(side: Side, kind: WeaponKind): boolean {
  const m = modsFor(side);
  return performance.now() < m.disableUntil && m.disabledType === kind;
}

export function pushBanner(side: Side, title: string, opts?: { sub?: string; lines?: string[]; color?: string; ms?: number }): void {
  const color = opts?.color ?? (side === SIDE.LEFT ? 'var(--left)' : 'var(--right)');
  (sim as any).fxBanners = (sim as any).fxBanners || [];
  (sim as any).fxBanners.push({ side, text: title, sub: opts?.sub, lines: opts?.lines, color, t0: performance.now(), ms: opts?.ms ?? 2600 });
}

export function applyBuff(side: Side): void {
  const m = modsFor(side);
  m.dmgMul = MODS.buffMultiplier;
  m.dmgUntil = performance.now() + MODS.buffDurationMs;
  // banner FX
  pushBanner(side, 'BUFF!', {
    sub: `Damage x${MODS.buffMultiplier}`,
    lines: [
      `Duration: ${(MODS.buffDurationMs / 1000) | 0}s`,
    ],
  });
}

export function applyDebuff(targetSide: Side, kind: WeaponKind | null = null): void {
  const m = modsFor(targetSide);
  const pool = MODS.allowedDebuffs as readonly WeaponKind[];
  let k: WeaponKind | null = kind;
  if (k === null) {
    if (pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      k = pool[idx] ?? null;
    } else {
      k = null;
    }
  }
  m.disabledType = k;
  m.disableUntil = performance.now() + MODS.debuffDurationMs;
  const txt = 'DEBUFF';
  const sub = k ? `${String(k).toUpperCase()} DISABLED` : 'SYSTEMS OFFLINE';
  pushBanner(targetSide, txt, {
    sub,
    lines: [
      `Duration: ${(MODS.debuffDurationMs / 1000) | 0}s`,
    ],
  });
}

export type { WeaponKind, SideMods };

