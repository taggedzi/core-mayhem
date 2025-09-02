// src/render/drawModel.ts
import { Composite } from 'matter-js';

import { WEAPON_WINDUP_MS } from '../config';
import { WALL_T } from '../config'; // used for wall thickness
import { LASER_FX } from '../config';
import { PROJECTILE_STYLE, PROJECTILE_OUTLINE } from '../config';
import { GAMEOVER } from '../config';
import { sim } from '../state';

import { colorForAmmo } from './colors';

export type DrawCommand =
  | {
      kind: 'circle';
      x: number;
      y: number;
      r: number;
      stroke?: string;
      fill?: string;
      lineWidth?: number;
      alpha?: number;
      composite?: GlobalCompositeOperation | 'lighter' | 'source-over';
      shadowBlur?: number;
      shadowColor?: string;
    }
  | {
      kind: 'line';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke?: string;
      lineWidth?: number;
      alpha?: number;
      lineDash?: number[];
      lineDashOffset?: number;
      lineCap?: CanvasLineCap;
      composite?: GlobalCompositeOperation | 'lighter' | 'source-over';
      shadowBlur?: number;
      shadowColor?: string;
    }
  | {
      kind: 'text';
      x: number;
      y: number;
      text: string;
      font?: string;
      fill?: string;
      align?: CanvasTextAlign;
      baseline?: CanvasTextBaseline;
    }
  | {
      kind: 'wedge';
      cx: number;
      cy: number;
      r0: number;
      r1: number;
      a0: number;
      a1: number;
      fill?: string;
      stroke?: string;
      lineWidth?: number;
      alpha?: number;
    }
  | {
      kind: 'poly';
      points: { x: number; y: number }[];
      stroke?: string;
      fill?: string;
      lineWidth?: number;
      close?: boolean;
      alpha?: number;
      composite?: GlobalCompositeOperation | 'lighter' | 'source-over';
      shadowBlur?: number;
      shadowColor?: string;
    }
  | {
      kind: 'arc';
      cx: number;
      cy: number;
      r: number;
      a0: number;
      a1: number;
      stroke?: string;
      lineWidth?: number;
      alpha?: number;
    }
  | {
      kind: 'path';
      points: { x: number; y: number }[];
      stroke?: string;
      lineWidth?: number;
      alpha?: number;
      composite?: GlobalCompositeOperation | 'lighter' | 'source-over';
      shadowBlur?: number;
      shadowColor?: string;
    }
  | {
      kind: 'rect';
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: string;
      alpha?: number;
    }
  | {
      kind: 'gradLine';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      from: string;
      to: string;
      lineWidth?: number;
      alpha?: number;
      lineCap?: CanvasLineCap;
      composite?: GlobalCompositeOperation | 'lighter' | 'source-over';
    };

export interface Scene {
  width: number;
  height: number;
  commands: DrawCommand[];
}

/** Pure: read minimal parts of sim and emit draw commands. No canvas/DOM here. */
export function toDrawCommands(now: number = performance.now()): Scene {
  const W = sim.W ?? 800;
  const H = sim.H ?? 600;
  const cmds: DrawCommand[] = [];

  // Midline (dashed)
  cmds.push({
    kind: 'line',
    x1: W / 2,
    y1: 0,
    x2: W / 2,
    y2: H,
    stroke: '#20336e',
    lineWidth: 2,
    lineDash: [6, 6],
  });

  const addCore = (core: any, colorVar: string) => {
    if (!core?.center) return;

    const cx = core.center.x,
      cy = core.center.y;
    const ringR: number = (core.ringR as number) ?? 20; // treat as SHIELD OUTER radius
    const rot: number = (core.rot as number) ?? 0;
    const segHP: number[] = core.segHP ?? [];
    const segHPmax: number = core.segHPmax ?? 1;
    const N = segHP.length | 0;

    // visual constants
    const SEG_THICK = 24;
    const SHIELD_THICK = 6;
    const GAP_CORE_TO_SEG = 4;
    const GAP_SEG_TO_SHIELD = 3;

    // derive radii (outside → inside)
    const shieldR1 = ringR; // shield OUTER
    const shieldR0 = Math.max(2, shieldR1 - SHIELD_THICK); // shield INNER
    const segR1 = Math.max(2, shieldR0 - GAP_SEG_TO_SHIELD); // segment OUTER
    const segR0 = Math.max(2, segR1 - SEG_THICK); // segment INNER
    const centerR = Math.max(2, segR0 - GAP_CORE_TO_SEG); // core center dot

    // center dot
    cmds.push({ kind: 'circle', x: cx, y: cy, r: centerR, fill: colorVar });

    // segment wedges (donut sectors)
    // segment wedges (donut between segR0..segR1)
    if (N > 0) {
      for (let i = 0; i < N; i++) {
        const a0 = rot + (i * 2 * Math.PI) / N;
        const a1 = rot + ((i + 1) * 2 * Math.PI) / N;
        const hp = Math.max(0, segHP[i] ?? 0);
        const ratio = Math.min(1, hp / Math.max(1, segHPmax));
        const alpha = 0.15 + 0.7 * ratio; // dimmer when damaged
        cmds.push({ kind: 'wedge', cx, cy, r0: segR0, r1: segR1, a0, a1, fill: colorVar, alpha });
      }
    }

    // shield ring as a stroked circle centered between shieldR0..shieldR1
    cmds.push({
      kind: 'circle',
      x: cx,
      y: cy,
      r: (shieldR0 + shieldR1) * 0.5,
      stroke: colorVar,
      lineWidth: Math.max(1, shieldR1 - shieldR0),
    });
  };

  // LEFT core in left color, RIGHT core in right color
  if (sim.coreL) addCore(sim.coreL, 'var(--left)');
  if (sim.coreR) addCore(sim.coreR, 'var(--right)');
  {
    interface FxArmItem {
      x: number;
      y: number;
      until: number;
      color?: string;
    }
    const fxList = (sim as any).fxArm as FxArmItem[] | undefined;

    if (fxList?.length) {
      for (const fx of fxList) {
        if (!fx || fx.until <= now) continue;
        const left = (fx.until - now) / WEAPON_WINDUP_MS; // 1 → 0
        const pulse = 0.5 + 0.5 * Math.sin((1 - left) * Math.PI * 2.5);
        const r0 = 10,
          r1 = 16;
        const r = r0 + (1 - left) * (r1 - r0);
        const color = fx.color ?? 'var(--accent)';
        cmds.push({
          kind: 'circle',
          x: fx.x,
          y: fx.y,
          r,
          stroke: color,
          lineWidth: 3,
          alpha: 0.35 + 0.45 * pulse,
        });
      }
    }
  }
  // ammo dots (read-only from Matter world)
  {
    const w = sim.world;
    if (w) {
      const bodies = Composite.allBodies(w);
      for (const b of bodies) {
        const plug = (b as any).plugin;
        if (!plug || plug.kind !== 'ammo') continue;
        const col = colorForAmmo(String(plug.type));
        const r = (b as any).circleRadius ?? 6;
        cmds.push({ kind: 'circle', x: b.position.x, y: b.position.y, r, fill: col });
      }
    }
  }
  // Projectiles: trails + bodies (approximate legacy look)
  {
    const w = sim.world;
    if (w) {
      const bodies = Composite.allBodies(w);
      for (const b of bodies) {
        const plug = (b as any).plugin;
        if (!plug || plug.kind !== 'projectile') continue;
        const sty = (PROJECTILE_STYLE as any)[plug.ptype] ?? PROJECTILE_STYLE.cannon;
        const pos = b.position;
        const vel = (b as any).velocity ?? { x: 0, y: 0 };
        const speed = Math.hypot(vel.x, vel.y);

        // Trail
        const trailLen = Math.min(30, 6 + speed * 2);
        const tx = pos.x - vel.x * trailLen * 0.8;
        const ty = pos.y - vel.y * trailLen * 0.8;
        cmds.push({
          kind: 'gradLine',
          x1: pos.x,
          y1: pos.y,
          x2: tx,
          y2: ty,
          from: sty.glow,
          to: 'rgba(0,0,0,0)',
          alpha: 1,
          lineWidth: Math.max(2, 0.06 * trailLen),
          lineCap: 'round',
          composite: 'lighter',
        });

        // Body
        const outline = PROJECTILE_OUTLINE;
        const ptype = String(plug.ptype);
        if (ptype === 'missile') {
          const ang = Math.atan2(vel.y, vel.x);
          const ux = Math.cos(ang), uy = Math.sin(ang);
          const nx = -uy, ny = ux;
          const r = 9;
          const nose = { x: pos.x + ux * r, y: pos.y + uy * r };
          const tailR = { x: pos.x - ux * r * 0.6 + nx * r * 0.55, y: pos.y - uy * r * 0.6 + ny * r * 0.55 };
          const tailL = { x: pos.x - ux * r * 0.6 - nx * r * 0.55, y: pos.y - uy * r * 0.6 - ny * r * 0.55 };
          cmds.push({ kind: 'poly', points: [nose, tailR, tailL], fill: sty.fill, stroke: outline, lineWidth: 2, close: true, shadowBlur: 12, shadowColor: sty.glow, composite: 'lighter' });
          // engine flare
          const t0 = { x: pos.x - ux * r * 0.6, y: pos.y - uy * r * 0.6 };
          const t1 = { x: pos.x - ux * r * 1.2, y: pos.y - uy * r * 1.2 };
          cmds.push({ kind: 'line', x1: t0.x, y1: t0.y, x2: t1.x, y2: t1.y, stroke: sty.glow, lineWidth: 3, alpha: 1, composite: 'lighter', lineCap: 'round' });
        } else if (ptype === 'mortar') {
          cmds.push({ kind: 'circle', x: pos.x, y: pos.y, r: 6, fill: sty.fill, stroke: outline, lineWidth: 2, shadowBlur: 10, shadowColor: sty.glow, composite: 'lighter' });
          cmds.push({ kind: 'line', x1: pos.x - 4, y1: pos.y - 4, x2: pos.x + 4, y2: pos.y + 4, stroke: '#FFFFFF', lineWidth: 1.5 });
        } else if (ptype === 'artillery') {
          const ang = Math.atan2(vel.y, vel.x);
          const ux = Math.cos(ang), uy = Math.sin(ang);
          const nx = -uy, ny = ux;
          const r = 10;
          const p1 = { x: pos.x + ux * r, y: pos.y + uy * r };
          const p2 = { x: pos.x, y: pos.y + ny * 6 };
          const p3 = { x: pos.x - ux * r, y: pos.y - uy * r };
          const p4 = { x: pos.x, y: pos.y - ny * 6 };
          cmds.push({ kind: 'poly', points: [p1, p2, p3, p4], fill: sty.fill, stroke: outline, lineWidth: 2, close: true, shadowBlur: 10, shadowColor: sty.glow, composite: 'lighter' });
        } else {
          // cannon
          cmds.push({ kind: 'circle', x: pos.x, y: pos.y, r: 5, fill: sty.fill, stroke: outline, lineWidth: 2, shadowBlur: 8, shadowColor: sty.glow, composite: 'lighter' });
        }
      }
    }
  }
  {
    const w = sim.world;
    if (!w) return { width: W, height: H, commands: cmds };

    const bodies = Composite.allBodies(w);

    for (const b of bodies) {
      const plug = (b as any).plugin;
      if (!plug) continue;

      // PINS — filled dots
      if (plug.kind === 'pin') {
        const r = ((b as any).circleRadius ?? 4) as number;
        cmds.push({
          kind: 'circle',
          x: b.position.x,
          y: b.position.y,
          r,
          fill: '#2b3a78',
        });
        continue;
      }

      // ROTORS — thin outline polygons
      if (plug.kind === 'rotor') {
        const v = (b as any).vertices as { x: number; y: number }[] | undefined;
        if (v && v.length >= 2) {
          cmds.push({
            kind: 'poly',
            points: v,
            stroke: '#2b3a78',
            lineWidth: 2,
            close: true,
          });
        }
        continue;
      }

      // PIPE WALLS — single vertical stroke at rectangle centerline
      if (plug.kind === 'pipeWall') {
        const m = b.bounds;
        const cx = (m.min.x + m.max.x) * 0.5;
        cmds.push({
          kind: 'line',
          x1: cx,
          y1: m.min.y,
          x2: cx,
          y2: m.max.y,
          stroke: '#3558b6',
          lineWidth: WALL_T,
        });
        continue;
      }

      // LANE WALLS — single vertical stroke in theme color
      if (plug.kind === 'laneWall') {
        const m = b.bounds;
        const cx = (m.min.x + m.max.x) * 0.5;
        cmds.push({
          kind: 'line',
          x1: cx,
          y1: m.min.y,
          x2: cx,
          y2: m.max.y,
          stroke: 'var(--line)', // renderer resolves CSS var
          lineWidth: WALL_T,
        });
        continue;
      }
    }
  }

  // Laser beams (modern fxBeams, from weapons)
  {
    const list = (sim as any).fxBeams as
      | { x1: number; y1: number; x2: number; y2: number; side: number; t0: number; tEnd: number }[]
      | undefined;
    if (list?.length) {
      for (const b of list) {
        if (now >= b.tEnd) continue; // prune expired
        const life = 1 - Math.max(0, Math.min(1, (now - b.t0) / Math.max(1, b.tEnd - b.t0)));
        const stroke = b.side < 0 ? 'var(--left)' : 'var(--right)';
        // jittered outer glow path
        const pts = jitterPolyline(b.x1, b.y1, b.x2, b.y2, LASER_FX.segments, LASER_FX.jitterAmp, now);
        cmds.push({
          kind: 'path',
          points: pts,
          stroke,
          alpha: 0.35 + 0.65 * life,
          lineWidth: LASER_FX.outerWidth * (0.85 + 0.15 * life),
          composite: 'lighter',
          shadowBlur: 18,
          shadowColor: stroke,
        });
        // inner dashed core
        cmds.push({
          kind: 'line',
          x1: b.x1,
          y1: b.y1,
          x2: b.x2,
          y2: b.y2,
          stroke: '#FFFFFF',
          lineWidth: LASER_FX.innerWidth,
          alpha: 0.85 * life,
          lineDash: [LASER_FX.dash, LASER_FX.dash * 0.6],
          lineDashOffset: -(now * 0.2),
        });
      }
    }
  }

  // Muzzle/impact flashes (modern fxBursts)
  {
    const bursts = (sim as any).fxBursts as
      | { x: number; y: number; t0: number; tEnd: number; side: number; kind: string }[]
      | undefined;
    if (bursts?.length) {
      for (const f of bursts) {
        if (now >= f.tEnd) continue; // prune expired
        const life01 = Math.max(0, Math.min(1, (f.tEnd - now) / LASER_FX.flashMs));
        const color = f.side < 0 ? 'var(--left)' : 'var(--right)';
        const r = 12 * (0.7 + 0.3 * life01);
        cmds.push({ kind: 'circle', x: f.x, y: f.y, r, stroke: color, lineWidth: 2, alpha: 0.45 + 0.55 * life01 });
      }
    }
  }

  // Beams (legacy fxBeam) — keep support for compatibility
  {
    const list = (sim as any).fxBeam as
      | { x0: number; y0: number; x1: number; y1: number; t0: number; ms: number; side: number }[]
      | undefined;
    if (list?.length) {
      for (const b of list) {
        const age = now - b.t0;
        if (age >= b.ms) continue; // prune expired
        const t = Math.max(0, Math.min(1, age / Math.max(1, b.ms)));
        const alpha = 0.65 * (1 - t) + 0.15;
        const width = 3 + 2 * Math.sin(t * Math.PI);
        const stroke = b.side < 0 ? 'var(--left)' : 'var(--right)';
        cmds.push({ kind: 'line', x1: b.x0, y1: b.y0, x2: b.x1, y2: b.y1, stroke, lineWidth: width, alpha });
      }
    }
  }

  // Impact / burn FX (legacy fxImp) — compatibility
  {
    const list = (sim as any).fxImp as
      | { x: number; y: number; t0: number; ms: number; color: string; kind: 'burst' | 'burn' }[]
      | undefined;
    if (list?.length) {
      for (const f of list) {
        const age = now - f.t0;
        if (age >= f.ms) continue; // prune expired
        const t = Math.max(0, Math.min(1, age / Math.max(1, f.ms)));
        if (f.kind === 'burst') {
          const power = Math.max(0, Number((f as any).power) || 0);
          const baseR = 10;
          const maxR = Math.max(22, Math.min(72, baseR + power * 1.2));
          const r = baseR + (maxR - baseR) * t;
          cmds.push({
            kind: 'circle',
            x: f.x,
            y: f.y,
            r,
            stroke: f.color,
            lineWidth: Math.max(1, 6 - 5 * t),
            alpha: 0.9 * (1 - t),
            composite: 'lighter',
            shadowBlur: 14,
            shadowColor: f.color,
          });
        } else {
          const r = 10 + 8 * t;
          cmds.push({ kind: 'circle', x: f.x, y: f.y, r, stroke: f.color, lineWidth: 2, alpha: 0.55 * (1 - t), composite: 'lighter' });
        }
      }
    }
  }

  // Sweep indicator for missiles
  {
    const list = (sim as any).fxSweep as
      | { x: number; y: number; t0: number; ms: number; a0: number; a1: number; side: number }[]
      | undefined;
    if (list?.length) {
      for (const s of list) {
        const age = now - s.t0;
        if (age >= s.ms) continue; // prune expired
        const t = Math.max(0, Math.min(1, age / Math.max(1, s.ms)));
        const color = s.side < 0 ? 'var(--left)' : 'var(--right)';
        const a = s.a0 + t * (s.a1 - s.a0);
        const r = 20;
        // arc segment
        cmds.push({ kind: 'arc', cx: s.x, cy: s.y, r, a0: s.a0, a1: s.a1, stroke: color, lineWidth: 2, alpha: 0.55 });
        // pointer line
        cmds.push({ kind: 'line', x1: s.x, y1: s.y, x2: s.x + Math.cos(a) * (r + 6), y2: s.y + Math.sin(a) * (r + 6), stroke: color, lineWidth: 2, alpha: 0.55 });
      }
    }
  }

  // Sparks (particles from impacts/explosions)
  {
    const list = (sim as any).fxSparks as
      | { x: number; y: number; vx: number; vy: number; t0: number; ms: number; color: string }[]
      | undefined;
    if (list?.length) {
      const G = 0.0022; // px/ms^2
      for (const p of list) {
        const age = now - p.t0;
        if (age < 0 || age >= p.ms) continue;
        const dt = age;
        const x = p.x + p.vx * dt;
        const y = p.y + p.vy * dt + 0.5 * G * dt * dt;
        const fade = 1 - age / p.ms;
        const len = 6 + 8 * fade;
        const nx = p.vx, ny = p.vy + G * dt;
        const n = Math.max(0.001, Math.hypot(nx, ny));
        const ux = nx / n,
          uy = ny / n;
        cmds.push({
          kind: 'gradLine',
          x1: x,
          y1: y,
          x2: x - ux * len,
          y2: y - uy * len,
          from: p.color,
          to: 'rgba(0,0,0,0)',
          lineWidth: 2,
          alpha: 0.9 * fade,
          lineCap: 'round',
          composite: 'lighter',
        });
      }
    }
  }

  // Game Over banner
  if ((sim as any).gameOver) {
    const winner = (sim as any).winner as -1 | 1 | 0;
    const msg = winner === 0 ? 'STALEMATE' : winner === -1 ? 'LEFT WINS' : 'RIGHT WINS';
    const t0 = (sim as any).winnerAt ?? now;
    const remainMs = Math.max(0, GAMEOVER.bannerMs - (now - t0));
    const remainSec = Math.ceil(remainMs / 1000);

    const bw = Math.min(W * 0.8, 720);
    const bh = Math.min(H * 0.22, 180);
    const x = (W - bw) / 2;
    const y = (H - bh) / 2;

    cmds.push({ kind: 'rect', x, y, w: bw, h: bh, fill: 'rgba(0,0,0,0.75)' });
    cmds.push({
      kind: 'text',
      x: W / 2,
      y: y + bh * 0.42,
      text: msg,
      font: `bold ${Math.floor(H * 0.085)}px var(--mono, monospace)`,
      fill: '#fff',
      align: 'center',
      baseline: 'middle',
    });
    const sub = GAMEOVER.autoRestart ? `Restarting in ${remainSec}s` : 'Press START to play again';
    cmds.push({
      kind: 'text',
      x: W / 2,
      y: y + bh * 0.75,
      text: sub,
      font: `bold ${Math.floor(H * 0.042)}px var(--mono, monospace)`,
      fill: '#ddd',
      align: 'center',
      baseline: 'middle',
    });
  }

  // Beams (laser lines that fade)
  {
    const list = (sim as any).fxBeam as
      | { x0: number; y0: number; x1: number; y1: number; t0: number; ms: number; side: number }[]
      | undefined;
    if (list?.length) {
      const now = performance.now();
      for (const b of list) {
        const t = Math.max(0, Math.min(1, (now - b.t0) / b.ms));
        const alpha = 0.65 * (1 - t) + 0.15;
        const width = 3 + 2 * Math.sin(t * Math.PI);
        const stroke = b.side < 0 ? 'var(--left)' : 'var(--right)';
        cmds.push({ kind: 'line', x1: b.x0, y1: b.y0, x2: b.x1, y2: b.y1, stroke, lineWidth: width, alpha });
      }
    }
  }

  // Impact / burn FX (approximation using circles)
  {
    const list = (sim as any).fxImp as
      | { x: number; y: number; t0: number; ms: number; color: string; kind: 'burst' | 'burn' }[]
      | undefined;
    if (list?.length) {
      const now = performance.now();
      for (const f of list) {
        const t = Math.max(0, Math.min(1, (now - f.t0) / f.ms));
        if (f.kind === 'burst') {
          const baseR = 8;
          const maxR = 48;
          const r = baseR + (maxR - baseR) * t * 0.82;
          cmds.push({ kind: 'circle', x: f.x, y: f.y, r, stroke: f.color, lineWidth: Math.max(1, 6 - 5 * t), alpha: 0.9 * (1 - t) });
        } else {
          const r = 10 + 8 * t;
          cmds.push({ kind: 'circle', x: f.x, y: f.y, r, stroke: f.color, lineWidth: 2, alpha: 0.55 * (1 - t) });
        }
      }
    }
  }

  return { width: W, height: H, commands: cmds };
}

// Jittered polyline between two points for laser glow
function jitterPolyline(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  segments: number,
  amp: number,
  now: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    const a = Math.sin((now * 0.004 + i * 1.7) * 2.0);
    const b = Math.cos((now * 0.003 + i * 1.3) * 1.6);
    const jx = (a * amp) / 2;
    const jy = (b * amp) / 2;
    pts.push({ x: x + jx, y: y + jy });
  }
  return pts;
}
