import { MODS } from '../config';
import { sim } from '../state';
import { SIDE, type Side, type WeaponKind, type SideMods } from '../types';
import { recordBuff, recordDebuff } from './stats';

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

export function clearTimedBuff(side: Side): void {
  const m = modsFor(side);
  m.buffKind = null;
  m.buffUntil = 0;
  m.dmgMul = 1;
  m.dmgUntil = 0;
  m.cooldownMul = 1;
  m.binFillMul = 1;
}

export function applyBuff(side: Side): void {
  clearTimedBuff(side);
  const m = modsFor(side);
  m.buffKind = 'damage';
  m.buffUntil = performance.now() + MODS.buffDurationMs;
  m.dmgMul = MODS.buffMultiplier;
  m.dmgUntil = m.buffUntil; // keep existing UI badge behavior
  try { recordBuff(side, 'damage'); } catch {}
  // banner FX
  pushBanner(side, 'BUFF!', {
    sub: `Damage x${MODS.buffMultiplier}`,
    lines: [
      `Duration: ${(MODS.buffDurationMs / 1000) | 0}s`,
    ],
  });
}

// New: immediate shield boost buff (adds points to ablative shield pool)
export function applyShieldBuff(side: Side, points?: number): void {
  const core: any = side === SIDE.LEFT ? (sim as any).coreL : (sim as any).coreR;
  if (!core) return;
  const add = Math.max(0, Math.round(points ?? (MODS as any).buffShieldPoints ?? 0));
  if (add <= 0) return;
  const max = typeof core.shieldHPmax === 'number' ? core.shieldHPmax : core.shieldHP ?? 0;
  const before = Math.max(0, Number(core.shieldHP ?? 0));
  const after = Math.min(max, before + add);
  core.shieldHP = after;
  try { recordBuff(side, 'shield'); } catch {}
  // banner FX
  pushBanner(side, 'BUFF!', {
    sub: `Shield +${add}`,
    lines: [
      `Total: ${Math.round(after)}/${Math.round(max)}`,
    ],
  });
}

type BuffKind = 'damage' | 'shield' | 'binBoost';

// Helper: choose a buff from allowed pool and apply it
export function applyRandomBuff(side: Side): void {
  const pool = ((MODS as any).allowedBuffs as readonly BuffKind[] | undefined) ?? ['damage'];
  const pick = pool[Math.floor(Math.random() * pool.length)] ?? 'damage';
  if (pick === 'shield') applyShieldBuff(side);
  else if (pick === 'binBoost') applyBinBoostBuff(side);
  else applyBuff(side);
}

// Timed buff example: Cooldown Haste
// Reduces weapon cooldowns by multiplier (<1 = faster). Uses the unified timed buff slot.
export function applyCooldownBuff(side: Side, mult?: number): void {
  clearTimedBuff(side);
  const m = modsFor(side);
  m.buffKind = 'cooldown';
  m.buffUntil = performance.now() + MODS.buffDurationMs;
  m.cooldownMul = Math.max(0.2, Math.min(1, Number(mult ?? (MODS as any).cooldownBuffMultiplier ?? 0.6)));
  try { recordBuff(side, 'cooldown'); } catch {}
  pushBanner(side, 'BUFF!', {
    sub: 'Cooldown Haste',
    lines: [
      `x${(m.cooldownMul).toFixed(2)} cooldown`,
      `Duration: ${(MODS.buffDurationMs / 1000) | 0}s`,
    ],
  });
}

export function currentCooldownMul(side: Side): number {
  const m = modsFor(side) as any;
  const now = performance.now();
  if ((m.buffKind === 'cooldown') && now < (m.buffUntil ?? 0)) return Math.max(0.2, Math.min(1, m.cooldownMul ?? 1));
  return 1;
}

export function clearTimedDebuff(side: Side): void {
  const m = modsFor(side);
  m.disabledType = null;
  m.disableUntil = 0;
}

// Timed buff: Bin Boost — increases bin fill per deposit
export function applyBinBoostBuff(side: Side, mult?: number, durationMs?: number): void {
  clearTimedBuff(side);
  const m = modsFor(side);
  m.buffKind = 'binBoost';
  const dur = Math.max(1000, Math.round(durationMs ?? (MODS as any).binBoostDurationMs ?? MODS.buffDurationMs));
  m.buffUntil = performance.now() + dur;
  m.binFillMul = Math.max(1, Number(mult ?? (MODS as any).binBoostMultiplier ?? 2));
  try { recordBuff(side, 'binBoost'); } catch {}
  pushBanner(side, 'BUFF!', {
    sub: 'Bin Boost',
    lines: [
      `x${(m.binFillMul).toFixed(2)} fill`,
      `Duration: ${(dur / 1000) | 0}s`,
    ],
  });
}

export function currentBinFillMul(side: Side): number {
  const m = modsFor(side) as any;
  const now = performance.now();
  if ((m.buffKind === 'binBoost') && now < (m.buffUntil ?? 0)) return Math.max(1, m.binFillMul ?? 1);
  return 1;
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
  try { recordDebuff(targetSide, k); } catch {}
  const txt = 'DEBUFF';
  const sub = k ? `${String(k).toUpperCase()} DISABLED` : 'SYSTEMS OFFLINE';
  pushBanner(targetSide, txt, {
    sub,
    lines: [
      `Duration: ${(MODS.debuffDurationMs / 1000) | 0}s`,
    ],
  });
}

// no re-exports needed

