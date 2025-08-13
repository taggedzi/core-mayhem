// src/render/drawModel.ts
import { Composite } from 'matter-js';

import { WEAPON_WINDUP_MS } from '../config';
import { WALL_T } from '../config'; // used for wall thickness
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
    }
  | {
      kind: 'line';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke?: string;
      lineWidth?: number;
    }
  | { kind: 'text'; x: number; y: number; text: string }
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
      lineWidth?: number;
      close?: boolean;
    };

export interface Scene {
  width: number;
  height: number;
  commands: DrawCommand[];
}

/** Pure: read minimal parts of sim and emit draw commands. No canvas/DOM here. */
export function toDrawCommands(): Scene {
  const W = sim.W ?? 800;
  const H = sim.H ?? 600;
  const cmds: DrawCommand[] = [];

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
    const now = performance.now();
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

  return { width: W, height: H, commands: cmds };
}
