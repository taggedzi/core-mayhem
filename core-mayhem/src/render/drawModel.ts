// src/render/drawModel.ts
import { Composite } from 'matter-js';

import { WEAPON_WINDUP_MS } from '../config';
import { WALL_T } from '../config'; // used for wall thickness
import { LASER_FX } from '../config';
import { PROJECTILE_STYLE, PROJECTILE_OUTLINE } from '../config';
import { GAMEOVER } from '../config';
import { SHIELD_RING_COLOR, SHIELD_RING_GLOW } from '../config';
import { MESMER } from '../config';
import { sim } from '../state';

import { colorForAmmo } from './colors';
import type { WeaponsType } from '../sim/weapons';
import type { FxArm, FxBeam, FxImpact, FxSweep, FxSpark, FxLaserBeam, FxBurst } from '../state';
import type { Core } from '../sim/core';

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
      stroke?: string;
      strokeWidth?: number;
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
      ccw?: boolean;
      stroke?: string;
      lineWidth?: number;
      alpha?: number;
      composite?: GlobalCompositeOperation | 'lighter' | 'source-over';
      shadowBlur?: number;
      shadowColor?: string;
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
      kind: 'vignette';
      cx: number;
      cy: number;
      r0: number; // inner radius (transparent)
      r1: number; // outer radius (full alpha)
      color?: string; // base color (default black)
      alpha?: number; // max alpha at r1
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
  tx?: number; // optional camera translation X (e.g., screen shake)
  ty?: number; // optional camera translation Y
}

/** Pure: read minimal parts of sim and emit draw commands. No canvas/DOM here. */
export function toDrawCommands(now: number = performance.now()): Scene {
  const W = sim.W ?? 800;
  const H = sim.H ?? 600;
  const cmds: DrawCommand[] = [];
  // Optional screen shake (moved from draw.ts)
  let tx = 0,
    ty = 0;
  {
    const t0 = sim.shakeT0 ?? 0;
    const ms = sim.shakeMs ?? 0;
    const amp = sim.shakeAmp ?? 0;
    const age = now - t0;
    if (age >= 0 && age < ms && amp > 0) {
      const k = 1 - age / ms;
      const a = now * 0.08;
      tx = Math.sin(a * 1.7) * amp * k;
      ty = Math.cos(a * 1.3) * amp * k;
    }
  }

  // Mesmer background (subtle, additive)
  if ((MESMER as any).enabled) {
    const mode = ((sim as any).mesmerMode as 'off' | 'low' | 'always' | undefined) ?? ((MESMER as any).mode ?? 'always');
    // Determine desired visibility based on mode + activity
    let target = 1; // default: fully visible
    // Activity metric (used for low-mode gating and arc fading)
    let quiet = 1; // 1 = calm, 0 = very busy
    {
      const wld = sim.world;
      let proj = 0;
      if (wld) {
        const bodies = Composite.allBodies(wld);
        for (const b of bodies) if ((b as any).plugin?.kind === 'projectile') proj++;
      }
      const beams = (sim as any).fxBeam?.length ?? 0;
      const imps = (sim as any).fxImp?.length ?? 0;
      // Normalize roughly: >14 projectiles, or multiple beams/impacts => busy
      const activity = Math.min(1, proj / 14 + (beams / 3) * 0.5 + (imps / 7) * 0.5);
      quiet = Math.max(0, 1 - activity);
    }
    if (mode === 'off') target = 0;
    else if (mode === 'low') target = quiet;
    // Smoothly ease visibility
    const lastT = ((sim as any).mesmerLastT as number) || now;
    const dt = Math.max(0, now - lastT);
    const tau = (MESMER as any).fadeMs ?? 1200; // ms time constant for fade (slower = smoother)
    const a = 1 - Math.exp(-dt / Math.max(1, tau)); // 0..1
    const prev = ((sim as any).mesmerFade as number) ?? 0;
    const fade = prev + (target - prev) * a;
    (sim as any).mesmerFade = fade;
    (sim as any).mesmerLastT = now;
    if (fade > 0.01) {
    const m = (sim as any).mesmer ?? ((sim as any).mesmer = {});
    // Regenerate stars if missing or canvas size changed
    if (!m.stars || m._w !== W || m._h !== H) {
      const N = MESMER.stars.count;
      const seed = ((sim.settings?.seed ?? 1) | 0) >>> 0;
      // tiny PRNG (mulberry32)
      let t = seed;
      const rnd = () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), t | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
      m.stars = Array.from({ length: N }, () => ({
        x: rnd() * W,
        y: rnd() * H,
        r: MESMER.stars.sizeMin + rnd() * (MESMER.stars.sizeMax - MESMER.stars.sizeMin),
        ph: rnd() * Math.PI * 2,
        col: rnd() < 0.5 ? MESMER.stars.color : MESMER.stars.altColor,
      }));
      m._w = W;
      m._h = H;
    }
    // draw stars (twinkle)
    if ((MESMER as any).stars?.enabled !== false) {
      const J = MESMER.stars.jitter;
      const baseA = MESMER.stars.alpha;
      for (const s of m.stars as any[]) {
        const tw = 0.4 + 0.6 * Math.sin(now * J + s.ph);
        const aS = baseA * tw * fade;
        if (aS > 0.002)
          cmds.push({ kind: 'circle', x: s.x, y: s.y, r: s.r, fill: s.col, alpha: aS, composite: 'lighter', shadowBlur: 8, shadowColor: s.col });
      }
    }

    // flowing arcs around cores
    const addArcs = (cx: number, cy: number, color: string) => {
      const n = MESMER.arcs.countPerSide;
      const baseR = Math.min(W, H) * MESMER.arcs.baseRFrac;
      const gap = Math.min(W, H) * MESMER.arcs.gapRFrac;
      for (let i = 0; i < n; i++) {
        const r = baseR + i * gap;
        const w = 0.9 + 0.35 * Math.sin((now * 0.0004 + i * 0.6) * (i % 2 ? 1 : -1));
        // Aim arc toward the midline for both sides so visuals mirror.
        const base = cx < W * 0.5 ? 0 : Math.PI; // left→right or right→left
        const drift = 0.6 * Math.sin(now * 0.00025 + i * 0.7);
        const aC = base + drift;
        const span = 0.9 + 0.5 * Math.sin(now * 0.0003 + i * 1.2);
        const a0 = aC - span * 0.5;
        const a1 = aC + span * 0.5;
        cmds.push({
          kind: 'arc',
          cx,
          cy,
          r,
          a0,
          a1,
          stroke: color,
          lineWidth: MESMER.arcs.width * w,
          // Arcs fade with both global fade and current quietness (less visible when busy)
          alpha: MESMER.arcs.alpha * fade * quiet,
          composite: 'lighter',
          shadowBlur: MESMER.arcs.blur,
          shadowColor: color,
        });
      }
    };

    if ((MESMER as any).arcs?.enabled !== false) {
      const cL = (sim.coreL as any)?.center;
      const cR = (sim.coreR as any)?.center;
      if (cL) addArcs(cL.x, cL.y, 'var(--left)');
      if (cR) addArcs(cR.x, cR.y, 'var(--right)');
    }
    } // end fade guard
  }

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

  const addCore = (core: Core, colorVar: string) => {
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

    // Shield ring: fade with ablative shield pool
    const havePool = typeof (core as any).shieldHP === 'number' && typeof (core as any).shieldHPmax === 'number';
    const ratio = havePool ? Math.max(0, Math.min(1, (core as any).shieldHP / Math.max(1, (core as any).shieldHPmax))) : 0;
    if (ratio > 0) {
      const rMid = (shieldR0 + shieldR1) * 0.5;
      const width = Math.max(1, shieldR1 - shieldR0);
      const alpha = 0.18 + 0.82 * ratio; // visible when low, brighter when full
      cmds.push({
        kind: 'circle',
        x: cx,
        y: cy,
        r: rMid,
        stroke: SHIELD_RING_COLOR,
        lineWidth: width,
        alpha,
        shadowBlur: Math.max(0, Math.round(SHIELD_RING_GLOW * (0.5 + 0.5 * ratio))),
        shadowColor: SHIELD_RING_COLOR,
      });
    }
  };

  // LEFT core in left color, RIGHT core in right color
  if (sim.coreL) addCore(sim.coreL, 'var(--left)');
  if (sim.coreR) addCore(sim.coreR, 'var(--right)');
  {
    const fxList = sim.fxArm as FxArm[] | undefined;

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
          const ny = ux; // perpendicular y-component (nx unused)
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
    const list = (sim.fxBeams ?? []) as FxLaserBeam[];
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
    const bursts = (sim.fxBursts ?? []) as FxBurst[];
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
    const list = sim.fxBeam as FxBeam[];
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
    const list = sim.fxImp as FxImpact[];
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
    const list = sim.fxSweep as FxSweep[];
    if (list?.length) {
      for (const s of list) {
        const age = now - s.t0;
        if (age >= s.ms) continue; // prune expired
        const t = Math.max(0, Math.min(1, age / Math.max(1, s.ms)));
        const color = s.side < 0 ? 'var(--left)' : 'var(--right)';
        // normalize to the minor arc between a0..a1 and remember direction
        let a0 = s.a0, a1 = s.a1;
        let d = a1 - a0;
        while (d > Math.PI) {
          a1 -= Math.PI * 2;
          d = a1 - a0;
        }
        while (d < -Math.PI) {
          a1 += Math.PI * 2;
          d = a1 - a0;
        }
        const a = a0 + t * d;
        const r = 20;
        // arc segment
        cmds.push({ kind: 'arc', cx: s.x, cy: s.y, r, a0, a1, ccw: d < 0, stroke: color, lineWidth: 2, alpha: 0.55 });
        // pointer line
        cmds.push({ kind: 'line', x1: s.x, y1: s.y, x2: s.x + Math.cos(a) * (r + 6), y2: s.y + Math.sin(a) * (r + 6), stroke: color, lineWidth: 2, alpha: 0.55 });
      }
    }
  }

  // Sparks (particles from impacts/explosions)
  {
    const list = (sim.fxSparks ?? []) as FxSpark[];
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

  // Paddles (as simple horizontal strokes)
  {
    const list = sim.paddles;
    if (list?.length) {
      for (const p of list) {
        cmds.push({ kind: 'line', x1: p.bounds.min.x, y1: p.position.y, x2: p.bounds.max.x, y2: p.position.y, stroke: '#2b3a78', lineWidth: 8 });
      }
    }
  }

  // Bins (containers) — outline, background, fill gauge, intake strip, labels
  {
    type BinStyle = { stroke?: string; box?: string; fill?: string; gauge?: string; text?: string; strokePx?: number };
    type Vec2 = { x: number; y: number };
    type BodyLike = { bounds: { min: Vec2; max: Vec2 }; position?: Vec2 };
    type RenderBin = import('../types').Bin & {
      box?: BodyLike;
      intake?: BodyLike;
      pos?: Vec2;
      style?: BinStyle;
    };
    const renderBinSet = (bins: import('../types').Bins | null): void => {
      if (!bins) return;
      const keys: (keyof typeof bins)[] = ['cannon', 'laser', 'missile', 'mortar', 'shield', 'repair', 'buff', 'debuff'];
      for (const key of keys) {
        const raw = (bins as any)[key] as RenderBin | undefined;
        if (!raw) continue;
        const wall = (raw.box ?? raw.body ?? raw.intake) as BodyLike | undefined;
        const b = wall?.bounds;
        if (!b) continue;
        const cx = raw.pos?.x ?? wall?.position?.x ?? (b.min.x + b.max.x) * 0.5;
        const cy = raw.pos?.y ?? wall?.position?.y ?? (b.min.y + b.max.y) * 0.5;
        const w = b.max.x - b.min.x;
        const h = b.max.y - b.min.y;

        const s: BinStyle = raw.style ?? {};
        const stroke = s.stroke ?? '#94a8ff';
        const boxBg = s.box ?? 'rgba(14,23,48,0.35)';
        const fillCol = s.fill ?? (key === 'buff' ? '#5CFF7A' : key === 'debuff' ? '#FF6B6B' : '#8fb0ff');
        const gaugeCol = s.gauge ?? (key === 'buff' ? '#5CFF7A' : key === 'debuff' ? '#FF6B6B' : '#ffffff');
        const textCol = s.text ?? '#cfe1ff';

        // Outline
        cmds.push({ kind: 'poly', points: [
          { x: cx - w / 2, y: cy - h / 2 },
          { x: cx + w / 2, y: cy - h / 2 },
          { x: cx + w / 2, y: cy + h / 2 },
          { x: cx - w / 2, y: cy + h / 2 },
        ], stroke, lineWidth: Math.max(2, (sim.W || 800) * 0.0025), close: true });

        // Internal background + fill
        const inset = Math.max(1, (sim.W || 800) * 0.0025 * 0.65);
        const innerW = w - inset * 2;
        const innerH = h - inset * 2;
        cmds.push({ kind: 'rect', x: cx - innerW / 2, y: cy - innerH / 2, w: innerW, h: innerH, fill: boxBg });
        if (typeof raw.fill === 'number' && typeof raw.cap === 'number' && raw.cap > 0) {
          const frac = Math.max(0, Math.min(1, raw.fill / raw.cap));
          const fillH = innerH * frac;
          cmds.push({ kind: 'rect', x: cx - innerW / 2, y: cy + innerH / 2 - fillH, w: innerW, h: fillH, fill: fillCol, alpha: 0.85 });
        }

        // Intake strip
        if (raw.intake?.bounds) {
          const ib = raw.intake.bounds;
          const iy = (ib.min.y + ib.max.y) * 0.5;
          cmds.push({ kind: 'line', x1: ib.min.x, y1: iy, x2: ib.max.x, y2: iy, stroke: gaugeCol, lineWidth: Math.max(1, (sim.W || 800) * 0.002) });
        }

        // Labels
        const nameText = String(key).toUpperCase();
        const cap = raw.cap | 0;
        const fill = Math.min(raw.fill | 0, cap);
        const stats = `${fill}/${cap}`;
        const family = "system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif";
        cmds.push({ kind: 'text', x: cx, y: cy + h / 2 + 12, text: nameText, font: `12px ${family}`, fill: textCol, align: 'center', baseline: 'alphabetic' });
        cmds.push({ kind: 'text', x: cx, y: cy + h / 2 + 24, text: stats, font: `11px ${family}`, fill: textCol, align: 'center', baseline: 'alphabetic' });
      }
    };
    renderBinSet(sim.binsL);
    renderBinSet(sim.binsR);
  }

  // Overlays — side badges (buff/debuff)
  {
    const nowMs = now;
    const fontPx = Math.max(12, sim.H * 0.018);
    const mk = (side: number): void => {
      const m = side < 0 ? sim.modsL : sim.modsR;
      if (!m) return;
      const x = side < 0 ? sim.W * 0.22 : sim.W * 0.78;
      const y = 26;
      // Buff badge
      if (nowMs < (m.dmgUntil ?? 0)) {
        const tLeft = Math.max(0, Math.ceil(((m.dmgUntil ?? 0) - nowMs) / 1000));
        const w = 120, h = 22;
        cmds.push({ kind: 'rect', x: x - w / 2, y: y - h / 2, w, h, fill: '#032e12', alpha: 1 });
        cmds.push({ kind: 'line', x1: x - w / 2, y1: y - h / 2, x2: x + w / 2, y2: y - h / 2, stroke: '#5CFF7A', lineWidth: 2 });
        cmds.push({ kind: 'line', x1: x + w / 2, y1: y - h / 2, x2: x + w / 2, y2: y + h / 2, stroke: '#5CFF7A', lineWidth: 2 });
        cmds.push({ kind: 'line', x1: x + w / 2, y1: y + h / 2, x2: x - w / 2, y2: y + h / 2, stroke: '#5CFF7A', lineWidth: 2 });
        cmds.push({ kind: 'line', x1: x - w / 2, y1: y + h / 2, x2: x - w / 2, y2: y - h / 2, stroke: '#5CFF7A', lineWidth: 2 });
        cmds.push({ kind: 'text', x, y, text: `DMG x${(m.dmgMul ?? 1).toFixed(1)}  ${tLeft}s`, font: `${fontPx}px var(--mono, monospace)`, fill: '#5CFF7A', align: 'center', baseline: 'middle' });
      }
      // Debuff badge
      if (nowMs < (m.disableUntil ?? 0) && m.disabledType) {
        const tLeft = Math.max(0, Math.ceil(((m.disableUntil ?? 0) - nowMs) / 1000));
        const w = 140, h = 22, y2 = y + 26;
        cmds.push({ kind: 'rect', x: x - w / 2, y: y2 - h / 2, w, h, fill: '#3b0c0c', alpha: 1 });
        cmds.push({ kind: 'line', x1: x - w / 2, y1: y2 - h / 2, x2: x + w / 2, y2: y2 - h / 2, stroke: '#FF6B6B', lineWidth: 2 });
        cmds.push({ kind: 'line', x1: x + w / 2, y1: y2 - h / 2, x2: x + w / 2, y2: y2 + h / 2, stroke: '#FF6B6B', lineWidth: 2 });
        cmds.push({ kind: 'line', x1: x + w / 2, y1: y2 + h / 2, x2: x - w / 2, y2: y2 + h / 2, stroke: '#FF6B6B', lineWidth: 2 });
        cmds.push({ kind: 'line', x1: x - w / 2, y1: y2 + h / 2, x2: x - w / 2, y2: y2 - h / 2, stroke: '#FF6B6B', lineWidth: 2 });
        cmds.push({ kind: 'text', x, y: y2, text: `DISABLED ${(m.disabledType as string).toUpperCase()}  ${tLeft}s`, font: `${fontPx}px var(--mono, monospace)`, fill: '#FFB1B1', align: 'center', baseline: 'middle' });
      }
    };
    mk(-1);
    mk(1);
  }

  // Overlays — core stats disc and text
  {
    // Compute the current core center radius so the stats fill that area
    const centerRadius = (core: Core): number => {
      // Derive from the same geometry used above so the overlay matches visuals exactly
      const ringR = Number(core?.ringR ?? 0);
      if (ringR > 0) {
        const SHIELD_THICK = 6;
        const GAP_SEG_TO_SHIELD = 3;
        const SEG_THICK = 24;
        const GAP_CORE_TO_SEG = 4;
        const shieldR1 = ringR;
        const shieldR0 = Math.max(2, shieldR1 - SHIELD_THICK);
        const segR1 = Math.max(2, shieldR0 - GAP_SEG_TO_SHIELD);
        const segR0 = Math.max(2, segR1 - SEG_THICK);
        return Math.max(6, segR0 - GAP_CORE_TO_SEG);
      }
      // Fallback if ringR missing
      return Math.max(18, sim.H * 0.03);
    };

    const drawStats = (core: Core, color: string): void => {
      if (!core?.center) return;
      const x = core.center.x, y = core.center.y;
      // Fill nearly the entire inner core (leave a hairline margin)
      const r = Math.max(12, centerRadius(core) * 0.998);
      cmds.push({ kind: 'circle', x, y, r, fill: '#000', alpha: 0.32 });
      const hp = Math.max(0, Math.round(core.centerHP ?? 0));
      const sh = Math.max(0, Math.round(core.shieldHP ?? 0));
      // Two-line layout sized to nearly fill the center ring without crossing into segments
      const fs1 = Math.max(24, Math.min(260, r * 0.95)); // HP ≈ 95% of inner radius
      const fs2 = Math.max(18, Math.min(180, r * 0.65)); // Shield ≈ 65% of inner radius
      const gap = r * 0.06; // modest gap between lines
      // Distance between baselines (symmetric around center). Extents stay within circle when:
      // (sep + fs1)/2 < r and (sep + fs2)/2 < r — satisfied by the chosen ratios.
      const sep = 0.5 * fs1 + gap + 0.5 * fs2;
      const yHP = y - sep * 0.5;
      const ySH = y + sep * 0.5;
      const sw1 = Math.max(2, Math.min(12, fs1 * 0.10));
      const sw2 = Math.max(2, Math.min(10, fs2 * 0.10));
      const family = "system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif";
      cmds.push({ kind: 'text', x, y: yHP, text: String(hp), font: `bold ${fs1}px ${family}`, fill: '#fff', align: 'center', baseline: 'middle', stroke: '#000', strokeWidth: sw1 });
      cmds.push({ kind: 'text', x, y: ySH, text: `S:${sh}`, font: `bold ${fs2}px ${family}`, fill: sh > 0 ? color : '#9aa3b2', align: 'center', baseline: 'middle', stroke: '#000', strokeWidth: sw2 });
    };
    if (sim.coreL) drawStats(sim.coreL, 'var(--left)');
    if (sim.coreR) drawStats(sim.coreR, 'var(--right)');
  }

  // Overlays — weapon mounts
  {
    const mk = (wep: WeaponsType | null, color: string): void => {
      if (!wep) return;
      const entries: ReadonlyArray<readonly [string, { x: number; y: number } | undefined]> = [
        ['C', wep.cannon?.pos],
        ['L', wep.laser?.pos],
        ['M', wep.missile?.pos],
        ['R', wep.mortar?.pos],
      ];
      for (const [label, pos] of entries) {
        if (!pos) continue;
        cmds.push({ kind: 'circle', x: pos.x, y: pos.y, r: 10, fill: '#0a1227' });
        cmds.push({ kind: 'circle', x: pos.x, y: pos.y, r: 10, stroke: color, lineWidth: 2 });
        cmds.push({ kind: 'text', x: pos.x, y: pos.y + 3, text: String(label), font: `10px Verdana`, fill: color, align: 'center', baseline: 'middle' });
      }
    };
    mk(sim.wepL, 'var(--left)');
    mk(sim.wepR, 'var(--right)');
  }

  // Game Over banner
  if (sim.gameOver) {
    const winner = (sim.winner as -1 | 1 | 0) ?? 0;
    const msg = winner === 0 ? 'STALEMATE' : winner === -1 ? 'LEFT WINS' : 'RIGHT WINS';
    const t0 = sim.winnerAt ?? now;
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
    const list = sim.fxBeam as FxBeam[];
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
    const list = sim.fxImp as FxImpact[];
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

  // Vignette overlay last to subtly focus the center
  if ((MESMER as any)?.vignette?.enabled) {
    const inner = Math.min(W, H) * 0.5 * ((MESMER as any).vignette.innerFrac ?? 0.55);
    const outer = Math.hypot(W, H) * 0.5 * ((MESMER as any).vignette.outerFrac ?? 1.0);
    cmds.push({
      kind: 'vignette',
      cx: W / 2,
      cy: H / 2,
      r0: inner,
      r1: outer,
      color: (MESMER as any).vignette.color ?? 'rgba(0,0,0,1)',
      alpha: (MESMER as any).vignette.alpha ?? 0.5,
    });
  }

  return { width: W, height: H, commands: cmds, tx, ty };
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
