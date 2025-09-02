// Adapter (pure → canvas). Disabled for now to avoid behavior change.

// Adapter is the sole render path (no feature flags)

import { Composite } from 'matter-js';

// no direct config imports needed here anymore (adapter path handles visuals)
import { sim } from '../state';
import { SIDE, type Side } from '../types';

import { toDrawCommands } from './drawModel';
import { renderScene } from './renderScene';

import type { World as MatterWorld } from 'matter-js';

const SHOW_DAMPERS = true; // set false later to hide them entirely
const css = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Fail-fast + narrowing for world (so TS knows it's not null)
function assertWorld(w: MatterWorld | null): asserts w is MatterWorld {
  if (!w) throw new Error('World not initialized');
}

export function drawFrame(ctx: CanvasRenderingContext2D): void {
  const W = sim.W,
    H = sim.H;
  ctx.clearRect(0, 0, W, H);
  // screen shake (applies to whole frame)
  ctx.save();
  {
    const now = performance.now();
    const t0 = (sim as any).shakeT0 ?? 0;
    const ms = (sim as any).shakeMs ?? 0;
    const amp = (sim as any).shakeAmp ?? 0;
    const age = now - t0;
    if (age >= 0 && age < ms && amp > 0) {
      const k = 1 - age / ms;
      const a = now * 0.08;
      const dx = Math.sin(a * 1.7) * amp * k;
      const dy = Math.cos(a * 1.3) * amp * k;
      ctx.translate(dx, dy);
    }
  }
  const world = sim.world; // capture to allow narrowing
  assertWorld(world);

  // midline is rendered via the adapter scene

  // dampers (faint outline only)
  if (SHOW_DAMPERS) {
    for (const g of sim.gels) {
      const b = g.bounds;
      ctx.save();
      ctx.setLineDash([2, 10]); // thin dash
      ctx.lineWidth = 0.6; // thinner line
      ctx.strokeStyle = 'rgba(0,255,213,0.12)'; // low opacity
      ctx.strokeRect(b.min.x, b.min.y, b.max.x - b.min.x, b.max.y - b.min.y);
      ctx.restore();
    }
  }

  // pins/rotors/walls are rendered via the adapter scene

  // optional: intake visual (dashed box)
  Composite.allBodies(world).forEach((b) => {
    const k = (b as any).plugin?.kind;
    if (k === 'intake') {
      const m = b.bounds;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#44ffd5';
      ctx.strokeRect(m.min.x, m.min.y, m.max.x - m.min.x, m.max.y - m.min.y);
      ctx.restore();
    }
  });

  // flippers (as strokes)
  sim.flippers.forEach((f) => {
    ctx.save();
    ctx.strokeStyle = '#9fb8ff';
    ctx.lineWidth = 6; // separate control; set to WALL_T if you want global match
    ctx.beginPath();
    ctx.moveTo(f.bounds.min.x, f.position.y);
    ctx.lineTo(f.bounds.max.x, f.position.y);
    ctx.stroke();
    ctx.restore();
  });

  // lane walls are rendered via the adapter scene

  // paddles and bins are rendered via the adapter scene

  // cores, mounts, fx, ammo are rendered via the adapter scene

  // Always use adapter scene now
  const scene = toDrawCommands(performance.now());
  renderScene(ctx, scene);
  ctx.restore();
}

export function drawBins(ctx: CanvasRenderingContext2D, bins: any): void {
  if (!bins) return;

  const css = (name: string): string =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const lineT = parseFloat(css('--wall-t')) || Math.max(2, sim.W * 0.0025);

  const now = performance.now();
  const mods = (sim as any).mods ?? { dmgUntil: 0, dmgMul: 1, disableUntil: 0, disabledType: null };

  // helper: active state for buff/debuff
  const buffActive = now < (mods.dmgUntil ?? 0);
  const debuffActive = now < (mods.disableUntil ?? 0);

  // deterministic order just for consistent z-draw; positions still come from bin.pos
  const order = ['buff', 'cannon', 'laser', 'missile', 'debuff', 'mortar', 'shield', 'repair'];
  const keys = order
    .filter((k) => bins[k])
    .concat(Object.keys(bins).filter((k) => !order.includes(k)));

  for (const key of keys) {
    const bin = (bins as any)[key];
    if (!bin) continue;

    // prefer our thin-wall rectangle for geometry; fall back if needed
    const wall = bin.box ?? bin.body ?? bin.intake;
    if (!wall || !wall.bounds) continue;

    const cx = bin.pos?.x ?? wall.position.x;
    const cy = bin.pos?.y ?? wall.position.y;
    const w = wall.bounds.max.x - wall.bounds.min.x;
    const h = wall.bounds.max.y - wall.bounds.min.y;

    // style overrides per-bin (fallbacks preserved)
    const s = (bin as any).style ?? {};
    const stroke = s.stroke ?? '#94a8ff';
    const boxBg = s.box ?? 'rgba(14,23,48,0.35)';
    const fillCol =
      s.fill ?? (key === 'buff' ? '#5CFF7A' : key === 'debuff' ? '#FF6B6B' : '#8fb0ff');
    const gaugeCol =
      s.gauge ?? (key === 'buff' ? '#5CFF7A' : key === 'debuff' ? '#FF6B6B' : '#ffffff');
    const textCol = s.text ?? '#cfe1ff';
    const lineW = s.strokePx ?? lineT; // keep your scaling fallback

    // ---- 1) Outline (thin wall) ----
    ctx.save();
    ctx.lineWidth = lineW;
    ctx.strokeStyle = stroke;
    ctx.beginPath();
    ctx.rect(cx - w / 2, cy - h / 2, w, h);
    ctx.stroke();

    // ---- 2) Internal fill (bottom-up) ----
    if (typeof bin.fill === 'number' && typeof bin.cap === 'number' && bin.cap > 0) {
      const frac = Math.max(0, Math.min(1, bin.fill / bin.cap));
      const inset = Math.max(1, lineT * 0.65);
      const innerW = w - inset * 2;
      const innerH = h - inset * 2;
      const fillH = innerH * frac;

      // background (empty tank)
      ctx.fillStyle = boxBg;
      ctx.fillRect(cx - innerW / 2, cy - innerH / 2, innerW, innerH);

      // filled portion
      ctx.fillStyle = fillCol;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(cx - innerW / 2, cy + innerH / 2 - fillH, innerW, fillH);
      ctx.globalAlpha = 1.0;

      // ---- 5) Labels under the box (auto-fit) ----
      const bw = w; // box width
      const ch = h; // box height

      const nameText = key.toUpperCase();
      const cap = bin.cap | 0;
      const fill = Math.min(bin.fill | 0, cap);
      const statText = `${fill}/${cap}`;

      // positions under the box — tweak offsets if you want tighter spacing
      const labelY = cy + ch / 2 + 12;
      const statsY = labelY + 12;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';

      // first line (name)
      const namePx = fitFontPx(ctx, nameText, 12, bw * 0.95); // max 12px, fit to ~95% box width
      ctx.font = `${namePx}px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial`;
      ctx.fillStyle = css('--fg-weak');
      ctx.fillStyle = textCol; // for the name/values you draw
      ctx.fillText(nameText, cx, labelY);

      // second line (fill/cap)
      const statPx = fitFontPx(ctx, statText, 11, bw * 0.9);
      ctx.font = `${statPx}px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial`;
      ctx.fillStyle = css('--fg-dim');
      ctx.fillStyle = textCol; // for the name/values you draw
      ctx.fillText(statText, cx, statsY);
    }

    // ---- 3) Intake strip (collector surface) ----
    if (bin.intake?.bounds) {
      const ib = bin.intake.bounds;
      const ix1 = ib.min.x,
        ix2 = ib.max.x;
      const iy = (ib.min.y + ib.max.y) / 2;
      ctx.lineWidth = Math.max(1, lineW * 0.8);
      ctx.strokeStyle = gaugeCol;
      ctx.beginPath();
      ctx.moveTo(ix1, iy);
      ctx.lineTo(ix2, iy);
      ctx.stroke();
    }

    // ---- 4) Active FX for Buff / Debuff ----
    if (key === 'buff' && buffActive) {
      const tLeft = Math.ceil(((mods.dmgUntil ?? 0) - now) / 1000);
      const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(now * 0.012));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#5CFF7A';
      ctx.lineWidth = lineT * 2.2;
      ctx.globalAlpha = pulse * 0.7;
      ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#032e12cc';
      ctx.fillRect(cx - w / 2, cy - h / 2 - 16, w, 14);
      ctx.fillStyle = '#5CFF7A';
      ctx.font = `${Math.max(10, sim.H * 0.016)}px var(--mono, monospace)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`DMG x${(mods.dmgMul ?? 1).toFixed(1)}  ${tLeft}s`, cx, cy - h / 2 - 14);
      ctx.restore();
    }

    if (key === 'debuff' && debuffActive) {
      const tLeft = Math.ceil(((mods.disableUntil ?? 0) - now) / 1000);
      const kind = (mods.disabledType ?? '').toUpperCase();
      const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(now * 0.012));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#FF6B6B';
      ctx.lineWidth = lineT * 2.2;
      ctx.globalAlpha = pulse * 0.7;
      ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#3b0c0ccc';
      ctx.fillRect(cx - w / 2, cy - h / 2 - 16, w, 14);
      ctx.fillStyle = '#FFB1B1';
      ctx.font = `${Math.max(10, sim.H * 0.016)}px var(--mono, monospace)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        kind ? `DISABLED ${kind}  ${tLeft}s` : `DISABLED  ${tLeft}s`,
        cx,
        cy - h / 2 - 14,
      );
      ctx.restore();
    }

    ctx.restore();
  }
}

/*
// Legacy canvas rendering helpers (now migrated to drawModel). Keeping here commented
// to show previous implementation, but excluded from build to avoid unused deps.
function drawCore(ctx: CanvasRenderingContext2D, core: any): void {
  const x = core.center.x,
    y = core.center.y,
    R = core.radius;

  // --- Team rim only when shields are DOWN ---
  if ((core.shield ?? 0) <= 0) {
    const R = coreRadius(core);
    const w = CORE_RIM_WIDTH_R * R;
    ctx.save();
    ctx.lineWidth = w;
    ctx.strokeStyle = getCSS(core.side < 0 ? '--left' : '--right');
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(core.center.x, core.center.y, R + w * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // --- Shield ring at outer edge when shields are UP ---
  drawShieldRing(ctx, core);

  const n = core.segHP.length,
    step = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const hp = core.segHP[i];
    const t = hp / core.segHPmax;
    const a0 = i * step + core.rot - 0.04,
      a1 = (i + 1) * step + core.rot + 0.04;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, R * 0.86, a0, a1);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#0e1730' : '#0b1227';
    ctx.fill();
    if (t > 0) {
      ctx.save();
      ctx.globalAlpha = 0.15 + 0.75 * t;
      ctx.fillStyle = getCSS(core.side < 0 ? '--left' : '--right');
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, R * 0.86, a0, a1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.beginPath();
  ctx.arc(x, y, R * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = '#091125';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = getCSS(core.side < 0 ? '--left' : '--right');
  ctx.stroke();
}

function drawWeaponMounts(ctx: CanvasRenderingContext2D, wep: any, color: string): void {
  if (!wep) return;
  const entries = [
    ['C', wep.cannon?.pos],
    ['L', wep.laser?.pos],
    ['M', wep.missile?.pos],
    ['R', wep.mortar?.pos], // R for mortar (shell)
  ] as const;
  ctx.font = '10px Verdana';
  entries.forEach(([label, pos]) => {
    if (!pos) return;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#0a1227';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(label, pos.x - 3, pos.y + 3);
  });
}

function getCSS(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ---- helpers: projectile rendering + impact FX ----
function renderProjectiles(ctx: CanvasRenderingContext2D): void {
  const w = sim.world;
  assertWorld(w);
  const bodies = Composite.allBodies(w);
  for (const b of bodies) {
    const plug = (b as any).plugin;
    if (!plug || plug.kind !== 'projectile') continue;

    const p = b.position;
    const v = (b as any).velocity ?? { x: 0, y: 0 };
    const ang = Math.atan2(v.y, v.x);

    ctx.save();
    switch (plug.ptype) {
      case 'missile': {
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-6, 4);
        ctx.lineTo(-6, -4);
        ctx.closePath();
        ctx.fillStyle = '#ffd18b';
        ctx.fill();
        ctx.strokeStyle = '#ffae33';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }
      case 'mortar': {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#c7ff7a';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#87d34a';
        ctx.stroke();
        break;
      }
      case 'laser': {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#9fe6ff';
        ctx.fill();
        break;
      }
      default: {
        // cannon
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffe15a';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffb700';
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function renderImpactFX(ctx: CanvasRenderingContext2D): void {
  (sim as any).fxImp ??= [];
  const now = performance.now();
  // keep only active FX
  sim.fxImp = sim.fxImp.filter((f) => now - f.t0 < f.ms);

  for (const f of sim.fxImp) {
    const age = now - f.t0;
    const t = Math.max(0, Math.min(1, age / f.ms)); // 0..1

    if (f.kind === 'burst') {
      // ---- SHOCKWAVE RING ----
      const baseR = 8;
      const maxR = 48; // how big the wave gets; tweak if you like
      const r = baseR + (maxR - baseR) * t;

      ctx.save();

      // outer soft glow (additive) – cheap and pretty
      const prevComp = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.35 * (1 - t);
      const g = ctx.createRadialGradient(f.x, f.y, r * 0.55, f.x, f.y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.4)');
      g.addColorStop(1, f.color || '#ffd966');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fill();

      // crisp ring on top
      ctx.globalCompositeOperation = prevComp;
      ctx.globalAlpha = 0.9 * (1 - t);
      ctx.strokeStyle = f.color || '#ffd966';
      ctx.lineWidth = Math.max(1, 6 - 5 * t);
      ctx.beginPath();
      ctx.arc(f.x, f.y, r * 0.82, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    } else if (f.kind === 'burn') {
      // ---- LASER BURN ---- (colored rim + dark scorch)
      const r = 10 + 8 * t;
      ctx.save();

      // colored hot ring
      ctx.globalAlpha = 0.55 * (1 - t);
      ctx.strokeStyle = f.color || '#9fe6ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.stroke();

      // dark scorch using multiply so it shows over core fill
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.35 * (1 - t);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = prev;

      ctx.restore();
    } else {
      // fallback tiny pop if any legacy FX slips through
      const r = 6 + 20 * t;
      ctx.save();
      ctx.globalAlpha = 0.6 * (1 - t);
      ctx.strokeStyle = f.color || '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function renderBeams(ctx: CanvasRenderingContext2D): void {
  (sim as any).fxBeam ??= [];
  const now = performance.now();
  // keep active beams only
  sim.fxBeam = sim.fxBeam.filter((b) => now - b.t0 < b.ms);

  for (const b of sim.fxBeam) {
    const t = (now - b.t0) / b.ms; // 0..1
    const alpha = 0.65 * (1 - t) + 0.15; // fades
    const w = 3 + 2 * Math.sin(t * Math.PI); // pulses a bit
    const color = b.side < 0 ? css('--left') : css('--right');

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color || '#9fe6ff';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(b.x0, b.y0);
    ctx.lineTo(b.x1, b.y1);
    ctx.stroke();
    ctx.restore();
  }
}

function renderSweep(ctx: CanvasRenderingContext2D): void {
  (sim as any).fxSweep ??= [];
  const now = performance.now();
  // keep ones still within their ms window
  sim.fxSweep = sim.fxSweep.filter((s) => now - s.t0 < s.ms);

  for (const s of sim.fxSweep) {
    const t = (now - s.t0) / s.ms; // 0..1
    const color = s.side < 0 ? css('--left') : css('--right');
    const a = s.a0 + t * (s.a1 - s.a0); // pointer angle along the arc
    const r = 20; // radius of the sweep arc

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = color || '#9fe6ff';
    ctx.lineWidth = 2;

    // arc
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, s.a0, s.a1, false);
    ctx.stroke();

    // pointer
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + Math.cos(a) * (r + 6), s.y + Math.sin(a) * (r + 6));
    ctx.stroke();

    ctx.restore();
  }
}

function drawCoreStats(ctx: CanvasRenderingContext2D, core: any, color: string): void {
  if (!core?.center) return;
  const { x, y } = core.center;

  // font sizes that scale with canvas
  const fs1 = Math.max(12, Math.min(18, sim.H * 0.024)); // HP line
  const fs2 = Math.max(10, Math.min(14, sim.H * 0.018)); // Shield line

  // Integers for readability
  const hp = Math.max(0, Math.round(core.centerHP ?? 0));
  const sh = Math.max(0, Math.round(core.shieldHP ?? 0)); // <-- ablative shield pool

  // faint disc backdrop for contrast
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(x, y, Math.max(18, sim.H * 0.03), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // HP (top line)
  ctx.font = `bold ${fs1}px Verdana`;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(String(hp), x, y - fs2 * 0.55);
  ctx.fillStyle = '#fff';
  ctx.fillText(String(hp), x, y - fs2 * 0.55);

  // Shield HP (bottom line)
  const shieldText = `S:${sh}`;
  ctx.font = `bold ${fs2}px Verdana`;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(shieldText, x, y + fs2 * 0.75);
  ctx.fillStyle = sh > 0 ? color : '#9aa3b2';
  ctx.fillText(shieldText, x, y + fs2 * 0.75);
}

function coreRadius(c: any): number {
  return c?.outerR ?? c?.R ?? c?.radius ?? c?.ringR ?? Math.max(36, sim.H * 0.09);
}

function drawShieldRing(ctx: CanvasRenderingContext2D, core: any, colorOverride?: string): void {
  // Use ablative shield pool
  const hp = Math.max(0, core?.shieldHP ?? 0);
  const hpMax = Math.max(1, core?.shieldHPmax ?? 1);
  const frac = Math.max(0, Math.min(1, hp / hpMax));
  if (frac <= 0 || !core?.center) return;

  const R = coreRadius(core);
  const w = SHIELD_RING_WIDTH_R * R;

  // Pick color (override → team CSS → fallback)
  const teamCssName = core.side < 0 ? '--left' : '--right';
  const teamFromCss =
    (typeof getCSS === 'function'
      ? getCSS(teamCssName)?.trim()
      : typeof css === 'function'
        ? css(teamCssName)?.trim()
        : '') || '';
  const color = colorOverride ?? teamFromCss ?? SHIELD_RING_COLOR;

  // Alpha rises with fraction; soft glow
  ctx.save();
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.3 + 0.65 * frac;

  ctx.shadowColor = color;
  ctx.shadowBlur = SHIELD_RING_GLOW;

  ctx.beginPath();
  ctx.arc(core.center.x, core.center.y, R + w * 0.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawGameOverBanner(ctx: CanvasRenderingContext2D): void {
  if (!(sim as any).gameOver) return;

  const winner = (sim as any).winner as Side | 0;
  const msg = winner === 0 ? 'STALEMATE' : winner === -1 ? 'LEFT WINS' : 'RIGHT WINS';

  const now = performance.now();
  const t0 = (sim as any).winnerAt ?? now;
  const remainMs = Math.max(0, GAMEOVER.bannerMs - (now - t0));
  const remainSec = Math.ceil(remainMs / 1000);

  // banner box
  const bw = Math.min(sim.W * 0.8, 720);
  const bh = Math.min(sim.H * 0.22, 180);
  const x = (sim.W - bw) / 2;
  const y = (sim.H - bh) / 2;

  ctx.save();
  // backdrop
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, bw, bh);

  // main text
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = `bold ${Math.floor(sim.H * 0.085)}px var(--mono, monospace)`;
  ctx.fillStyle = '#fff';
  ctx.fillText(msg, sim.W / 2, y + bh * 0.42);

  // subtext (countdown or prompt)
  ctx.font = `bold ${Math.floor(sim.H * 0.042)}px var(--mono, monospace)`;
  ctx.fillStyle = '#ddd';

  if (GAMEOVER.autoRestart) {
    ctx.fillText(`Restarting in ${remainSec}s`, sim.W / 2, y + bh * 0.75);
  } else {
    ctx.fillText('Press START to play again', sim.W / 2, y + bh * 0.75);
  }

  ctx.restore();
}

function drawOneProjectile(ctx: CanvasRenderingContext2D, b: any): boolean {
  const p = b?.plugin;
  if (!p || p.kind !== 'projectile') return false;

  const sty = (PROJECTILE_STYLE as any)[p.ptype] ?? PROJECTILE_STYLE.cannon;
  const pos = b.position;
  const vel = (b as any).velocity ?? b.velocity;
  const speed = Math.hypot(vel.x, vel.y);

  // motion trail from velocity (no history needed)
  const trailLen = Math.min(30, 6 + speed * 2);
  const tx = pos.x - vel.x * trailLen * 0.8;
  const ty = pos.y - vel.y * trailLen * 0.8;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createLinearGradient(pos.x, pos.y, tx, ty);
  grad.addColorStop(0, sty.glow);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = Math.max(2, 0.06 * trailLen);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  // body styling
  ctx.shadowColor = sty.glow;
  ctx.shadowBlur = 12;
  ctx.fillStyle = sty.fill;
  ctx.strokeStyle = PROJECTILE_OUTLINE;
  ctx.lineWidth = 2;

  // draw by type
  switch (p.ptype) {
    case 'missile': {
      const ang = Math.atan2(vel.y, vel.x);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(ang);
      const r = 9;
      ctx.beginPath();
      ctx.moveTo(r, 0); // nose
      ctx.lineTo(-r * 0.6, r * 0.55); // tail fin
      ctx.lineTo(-r * 0.6, -r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // engine flare
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, 0);
      ctx.lineTo(-r * 1.2, 0);
      ctx.strokeStyle = sty.glow;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'mortar': {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // white diagonal stripe
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pos.x - 4, pos.y - 4);
      ctx.lineTo(pos.x + 4, pos.y + 4);
      ctx.stroke();
      break;
    }
    case 'artillery': {
      const ang = Math.atan2(vel.y, vel.x);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-10, 0);
      ctx.lineTo(0, -6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      break;
    }
    default: {
      // cannon (round but glowy)
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
  return true;
}

// Call this from drawFrame after background/obstacles:
export function renderProjectilesFancy(ctx: CanvasRenderingContext2D): void {
  const w = sim.world;
  assertWorld(w);
  const bodies = Composite.allBodies(w);
  for (const b of bodies) {
    drawOneProjectile(ctx, b as any);
  }
}

function teamColor(side: number): string {
  return side < 0 ? css('--left') || '#58e6ff' : css('--right') || '#ff69d4';
}

interface Point {
  x: number;
  y: number;
}

// Deterministic-ish jitter using time; no per-frame popping
function jitterPolyline(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  segs: number,
  amp: number,
  t: number,
): Point[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const x = x1 + (x2 - x1) * u;
    const y = y1 + (y2 - y1) * u;
    // phase moves slowly so it shimmers
    const k = u * 7 + t * 0.002;
    const nx = Math.sin(11 * k) * Math.cos(3.7 * k);
    const ny = Math.cos(9.2 * k) * Math.sin(4.1 * k);
    pts.push({
      x: x + nx * amp * (1 - Math.abs(0.5 - u) * 1.8),
      y: y + ny * amp * (1 - Math.abs(0.5 - u) * 1.8),
    });
  }
  return pts;
}

function pathFromPoints(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
  if (!pts || pts.length === 0) return;
  const first = pts[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (!p) continue;
    ctx.lineTo(p.x, p.y);
  }
}

function drawBurst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  life01: number,
): void {
  const r = LASER_FX.flashSize * (0.7 + 0.3 * life01);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.globalAlpha = 0.45 + 0.55 * life01;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // subtle rays
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.25 * life01;
  const rays = 6;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + life01 * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawLaserFX(ctx: CanvasRenderingContext2D): void {
  const beams = (sim as any).fxBeams ?? [];
  const bursts = (sim as any).fxBursts ?? [];
  const now = performance.now();

  // prune expired
  (sim as any).fxBeams = beams.filter((b: any) => b.tEnd > now);
  (sim as any).fxBursts = bursts.filter((b: any) => b.tEnd > now);

  // beams
  for (const b of beams) {
    const life = 1 - Math.max(0, Math.min(1, (now - b.t0) / (b.tEnd - b.t0)));
    const col = teamColor(b.side ?? -1);

    // Outer glow (jittered)
    const pts = jitterPolyline(b.x1, b.y1, b.x2, b.y2, LASER_FX.segments, LASER_FX.jitterAmp, now);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = col;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.35 + 0.65 * life;
    ctx.lineWidth = LASER_FX.outerWidth * (0.85 + 0.15 * life);
    pathFromPoints(ctx, pts);
    ctx.stroke();

    // Inner core (straight), animated dash
    ctx.shadowBlur = 0;
    ctx.strokeStyle = LASER_FX.coreColor;
    ctx.globalAlpha = 0.85 * life;
    ctx.lineWidth = LASER_FX.innerWidth;
    ctx.setLineDash([LASER_FX.dash, LASER_FX.dash * 0.6]);
    ctx.lineDashOffset = -(now * 0.2);
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.restore();
  }

  // muzzle / impact flashes
  for (const f of bursts) {
    const life01 = Math.max(0, Math.min(1, (f.tEnd - now) / LASER_FX.flashMs));
    drawBurst(ctx, f.x, f.y, teamColor(f.side ?? -1), life01);
  }
}
*/

function fitFontPx(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxPx: number,
  maxW: number,
  minPx = 8,
): number {
  let px = maxPx;
  while (px > minPx) {
    ctx.font = `${px}px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial`;
    if (ctx.measureText(text).width <= maxW) break;
    px -= 0.5;
  }
  return Math.max(px, minPx);
}

function drawSideModsBadge(ctx: CanvasRenderingContext2D, side: Side): void {
  const m = side === SIDE.LEFT ? sim.modsL : sim.modsR;
  if (!m) return;
  const now = performance.now();

  // position: near top header, inset per side
  const x = side === SIDE.LEFT ? sim.W * 0.22 : sim.W * 0.78;
  const y = 26; // align with your header baseline
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.max(12, sim.H * 0.018)}px var(--mono, monospace)`;

  // Buff badge
  if (now < m.dmgUntil) {
    const tLeft = Math.max(0, Math.ceil((m.dmgUntil - now) / 1000));
    ctx.fillStyle = '#032e12';
    ctx.strokeStyle = '#5CFF7A';
    ctx.lineWidth = 2;
    const w = 120,
      h = 22;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = '#5CFF7A';
    ctx.fillText(`DMG x${m.dmgMul.toFixed(1)}  ${tLeft}s`, x, y);
  }

  // Debuff badge
  if (now < m.disableUntil && m.disabledType) {
    const tLeft = Math.max(0, Math.ceil((m.disableUntil - now) / 1000));
    const y2 = y + 26; // stack below the buff badge if both present
    ctx.fillStyle = '#3b0c0c';
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 2;
    const w = 140,
      h = 22;
    ctx.fillRect(x - w / 2, y2 - h / 2, w, h);
    ctx.strokeRect(x - w / 2, y2 - h / 2, w, h);
    ctx.fillStyle = '#FFB1B1';
    ctx.fillText(`DISABLED ${m.disabledType.toUpperCase()}  ${tLeft}s`, x, y2);
  }
}
