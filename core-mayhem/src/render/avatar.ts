/**
 * src/render/avatar.ts
 * Procedural retro arcade avatar — flat-neon 1990s style.
 * One design, two team colors (var(--left) / var(--right)), emotion-driven animation.
 * No external assets; all drawing uses existing DrawCommand primitives.
 */

import { AVATAR } from '../config';
import { sim } from '../state';

import type { DrawCommand } from './drawModel';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AvatarEmotion =
  | 'idle'
  | 'entrance'
  | 'taunt'
  | 'flinch'
  | 'near_death'
  | 'powerup'
  | 'victory'
  | 'dead';

type SideLR = 'L' | 'R';

interface AvatarState {
  emotion: AvatarEmotion;
  startMs: number;
}

// ── Module state ──────────────────────────────────────────────────────────────

const _state: Record<SideLR, AvatarState> = {
  L: { emotion: 'idle', startMs: 0 },
  R: { emotion: 'idle', startMs: 0 },
};

// How long each emotion lasts before auto-returning to idle (0 = sticky)
const DURATION: Record<AvatarEmotion, number> = {
  idle:       0,
  entrance: 1800,
  taunt:    2200,
  flinch:   1000,
  near_death:  0,  // driven by HP each frame
  powerup:  1600,
  victory:     0,
  dead:        0,
};

// Higher = harder to interrupt
const PRIORITY: Record<AvatarEmotion, number> = {
  idle:       0,
  near_death: 1,
  entrance:   2,
  taunt:      3,
  powerup:    3,
  flinch:     4,
  victory:   10,
  dead:      10,
};

// ── Public API ────────────────────────────────────────────────────────────────

export function setAvatarEmotion(side: SideLR, emotion: AvatarEmotion): void {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const s = _state[side];
  if (s.emotion !== 'idle' && s.emotion !== 'near_death') {
    const dur = DURATION[s.emotion];
    const remaining = dur > 0 ? dur - (now - s.startMs) : Infinity;
    if (remaining > 0 && PRIORITY[emotion] < PRIORITY[s.emotion]) return;
  }
  s.emotion = emotion;
  s.startMs = now;
}

export function resetAvatarState(): void {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  _state.L = { emotion: 'entrance', startMs: now };
  _state.R = { emotion: 'entrance', startMs: now };
}

/** Map a banter event string to an avatar emotion for the speaking side. */
export function banterToAvatarEmotion(ev: string): AvatarEmotion | null {
  switch (ev) {
    case 'match_start':                                         return 'entrance';
    case 'big_hit': case 'stagger':
    case 'shields_down': case 'armor_break': case 'debuffed':  return 'flinch';
    case 'near_death':                                         return 'near_death';
    case 'taunt': case 'first_blood':                          return 'taunt';
    case 'comeback': case 'shields_up': case 'repair':         return 'powerup';
    default:                                                   return null;
  }
}

// ── Main draw entry point ─────────────────────────────────────────────────────

export function buildAvatarCmds(now: number, W: number, H: number): DrawCommand[] {
  const cfg = AVATAR as any;
  if (cfg?.enabled === false) return [];
  const out: DrawCommand[] = [];
  _drawSide(out, 'L', now, W, H, cfg);
  _drawSide(out, 'R', now, W, H, cfg);
  return out;
}

// ── Internal: resolve current emotion ────────────────────────────────────────

function _resolveState(side: SideLR, now: number): { emotion: AvatarEmotion; t: number } {
  const s = _state[side];
  let emotion = s.emotion;
  const t = now - s.startMs;

  // Auto-expire timed emotions back to idle
  const dur = DURATION[emotion];
  if (dur > 0 && t > dur) {
    _state[side] = { emotion: 'idle', startMs: now };
    emotion = 'idle';
  }

  // HP-driven near_death override (only when idle, game still running)
  if (emotion === 'idle' && !(sim as any).gameOver) {
    const core = side === 'L' ? (sim as any).coreL : (sim as any).coreR;
    if (core) {
      const hp = Number(core.centerHP ?? 0);
      const max = Number(core.centerHPmax ?? 500) || 500;
      if (hp > 0 && hp <= max * 0.2) emotion = 'near_death';
    }
  }

  return { emotion, t };
}

// ── Internal: draw one side ───────────────────────────────────────────────────

function _drawSide(
  cmds: DrawCommand[], side: SideLR, now: number, W: number, H: number, cfg: any,
): void {
  const blCX: number = cfg?.left?.cx ?? 250;
  const blCY: number = cfg?.left?.cy ?? 155;
  const orbR: number = cfg?.orbR ?? 52;

  // BL → canvas coords; right mirrors X
  const cx = side === 'L' ? blCX : W - blCX;
  const cy = H - blCY;

  const color = side === 'L' ? 'var(--left)' : 'var(--right)';
  const { emotion, t } = _resolveState(side, now);

  // ── Global alpha for entrance/death transitions ──
  let ga = 1.0;
  if (emotion === 'entrance') ga = Math.min(1, t / 900);
  if (emotion === 'dead')     ga = Math.max(0, 1 - t / 2200);

  // ── Orb pulse radius ──
  const pAmp: Record<AvatarEmotion, number> = {
    idle: 2, entrance: 5, taunt: 7, flinch: 5,
    near_death: 1.5, powerup: 9, victory: 12, dead: 0,
  };
  const pSpd: Record<AvatarEmotion, number> = {
    idle: 800, entrance: 400, taunt: 170, flinch: 220,
    near_death: 2000, powerup: 200, victory: 140, dead: 1000,
  };
  let pulseR = orbR + Math.sin(now / pSpd[emotion]) * pAmp[emotion];
  if (emotion === 'near_death' && Math.random() < 0.08) pulseR += Math.random() * 3 - 1.5;

  // ── Ring rotation speeds (rad/ms) ──
  const r1Spd: Record<AvatarEmotion, number> = {
    idle: 4e-4, entrance: 12e-4, taunt: 20e-4, flinch: 5e-4,
    near_death: 1.2e-4, powerup: 28e-4, victory: 50e-4, dead: 0,
  };
  let ang1 = now * r1Spd[emotion];
  let ang2 = now * r1Spd[emotion] * -0.62; // outer ring counter-rotates slower

  // Flinch: add angular wobble
  if (emotion === 'flinch') {
    const w = Math.sin(t * 0.045) * 0.18;
    ang1 += w;
    ang2 -= w * 1.3;
  }

  // ── Draw outer ring (4 segments) ──
  const r2 = cfg?.ring2 ?? { iR: 21, oR: 33, segs: 4, gap: 0.30 };
  const outerA: Record<AvatarEmotion, number> = {
    idle: 0.55, entrance: 0.55, taunt: 0.75, flinch: 0.60,
    near_death: 0.30, powerup: 0.80, victory: 0.90, dead: 0.15,
  };
  const outerGlow = emotion === 'victory' ? 16 : emotion === 'taunt' ? 10 : emotion === 'near_death' ? 0 : 5;
  _ringSegs(cmds, cx, cy, orbR + r2.iR, orbR + r2.oR, r2.segs, r2.gap, ang2,
    color, outerA[emotion] * ga, outerGlow);

  // ── Draw inner ring (6 segments) ──
  const r1 = cfg?.ring1 ?? { iR: 10, oR: 18, segs: 6, gap: 0.27 };
  const innerA: Record<AvatarEmotion, number> = {
    idle: 0.70, entrance: 0.70, taunt: 0.90, flinch: 0.75,
    near_death: 0.25, powerup: 0.95, victory: 1.00, dead: 0.10,
  };
  _ringSegs(cmds, cx, cy, orbR + r1.iR, orbR + r1.oR, r1.segs, r1.gap, ang1,
    color, innerA[emotion] * ga, 0);

  // ── Orb background circle ──
  const orbA: Record<AvatarEmotion, number> = {
    idle: 1, entrance: 1, taunt: 1, flinch: 1,
    near_death: 0.65, powerup: 1, victory: 1, dead: 0.5,
  };
  const orbGlow = emotion === 'victory' ? 22 : emotion === 'taunt' ? 12 : emotion === 'near_death' ? 0 : 7;
  cmds.push({
    kind: 'circle', x: cx, y: cy, r: pulseR,
    fill: '#040912', stroke: color, lineWidth: 3,
    alpha: orbA[emotion] * ga,
    shadowBlur: orbGlow, shadowColor: color,
  });

  // ── Flinch: brief red flash ──
  if (emotion === 'flinch' && t < 320) {
    cmds.push({
      kind: 'circle', x: cx, y: cy, r: pulseR,
      fill: '#ff2020',
      alpha: (1 - t / 320) * 0.38 * ga,
      composite: 'lighter',
    } as any);
  }

  // ── Victory: gold aura pulse ──
  if (emotion === 'victory') {
    cmds.push({
      kind: 'circle', x: cx, y: cy, r: pulseR + 7,
      fill: '#ffd700',
      alpha: (0.10 + Math.sin(now / 280) * 0.05) * ga,
      composite: 'lighter',
    } as any);
  }

  // ── Glint highlight (arcade token look) ──
  cmds.push({
    kind: 'circle',
    x: cx - orbR * 0.28, y: cy - orbR * 0.28,
    r: orbR * 0.22,
    fill: '#ffffff',
    alpha: 0.07 * ga,
  });

  // ── Face ──
  _drawFace(cmds, cx, cy, orbR, emotion, t, now, ga);

  // ── Arcade bezel corners ──
  const half = orbR + 37;
  const cornerA = (emotion === 'near_death' ? 0.30 : 0.50) * ga;
  _drawCorners(cmds, cx, cy, half, color, cornerA);
}

// ── Ring segments ─────────────────────────────────────────────────────────────

function _ringSegs(
  cmds: DrawCommand[],
  cx: number, cy: number,
  r0: number, r1: number,
  nSegs: number, gapFrac: number,
  baseAngle: number,
  color: string, alpha: number, shadowBlur: number,
): void {
  const step   = (Math.PI * 2) / nSegs;
  const segArc = step * (1 - gapFrac);
  for (let i = 0; i < nSegs; i++) {
    const a0 = baseAngle + i * step;
    cmds.push({
      kind: 'wedge', cx, cy, r0, r1,
      a0, a1: a0 + segArc,
      fill: color, alpha,
      shadowBlur, shadowColor: color,
    });
  }
}

// ── Face: dispatch ────────────────────────────────────────────────────────────

function _drawFace(
  cmds: DrawCommand[],
  cx: number, cy: number, orbR: number,
  emotion: AvatarEmotion, t: number, now: number,
  ga: number,
): void {
  const px      = Math.max(3, Math.round(orbR * 0.095)); // pixel-block size
  const eyeY    = cy - orbR * 0.18;
  const eyeOffX = orbR * 0.30;
  const mouthY  = cy + orbR * 0.35;
  const mouthW  = orbR * 0.64;

  let fc = '#ffffff';
  let fa = ga;
  if (emotion === 'flinch')     fc = '#ff7070';
  if (emotion === 'victory')    fc = '#ffd700';
  if (emotion === 'near_death') { fc = '#ff5050'; fa *= 0.60 + Math.sin(now / 380) * 0.35; }
  if (emotion === 'dead')       { fc = '#777777'; fa *= 0.40; }

  _drawEye(cmds, cx - eyeOffX, eyeY, px, emotion, t, now, fc, fa);
  _drawEye(cmds, cx + eyeOffX, eyeY, px, emotion, t, now, fc, fa);
  _drawMouth(cmds, cx, mouthY, mouthW, px, emotion, t, fc, fa);
}

// ── Eye shapes ────────────────────────────────────────────────────────────────

function _drawEye(
  cmds: DrawCommand[],
  ex: number, ey: number, px: number,
  emotion: AvatarEmotion, t: number, now: number,
  color: string, alpha: number,
): void {
  switch (emotion) {
    case 'flinch':
    case 'dead': {
      // X eyes
      const r = px * 1.6;
      cmds.push({ kind: 'line', x1: ex - r, y1: ey - r, x2: ex + r, y2: ey + r, stroke: color, lineWidth: px * 0.9, alpha } as any);
      cmds.push({ kind: 'line', x1: ex + r, y1: ey - r, x2: ex - r, y2: ey + r, stroke: color, lineWidth: px * 0.9, alpha } as any);
      break;
    }
    case 'victory': {
      // Star eyes: block + 4 sparkle arms
      _px(cmds, ex, ey, px * 2.5, px * 2.5, color, alpha);
      for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        _px(cmds, ex + Math.cos(a) * px * 3, ey + Math.sin(a) * px * 3, px * 0.9, px * 0.9, color, alpha * 0.7);
      }
      break;
    }
    case 'near_death': {
      // Droopy dot + sweat bead
      _px(cmds, ex, ey + px * 0.4, px * 1.4, px * 1.4, color, alpha);
      cmds.push({ kind: 'circle', x: ex + px * 1.6, y: ey + px * 2.0, r: px * 0.55, fill: '#3399ff', alpha: alpha * 0.75 } as any);
      break;
    }
    case 'taunt': {
      // Block eye + raised brow above
      _px(cmds, ex, ey, px * 2.0, px * 1.5, color, alpha);
      _px(cmds, ex, ey - px * 2.2, px * 2.4, px * 0.7, color, alpha * 0.85);
      break;
    }
    case 'powerup': {
      // Wide excited block + glint
      _px(cmds, ex, ey, px * 2.6, px * 2.2, color, alpha);
      _px(cmds, ex + px * 0.5, ey - px * 0.5, px * 0.7, px * 0.7, '#ffffff', alpha * 0.85);
      break;
    }
    case 'entrance': {
      // Scale in from zero
      const scale = Math.min(1, t / 500);
      const s = px * 2 * scale;
      if (s > 0.5) _px(cmds, ex, ey, s, s, color, alpha);
      break;
    }
    default: {
      // Idle: square dot with occasional blink
      const phase = (now % 4200) / 4200;
      const eyeH = phase > 0.93 ? px * 0.25 : px * 2;
      _px(cmds, ex, ey, px * 2, eyeH, color, alpha);
      break;
    }
  }
}

// ── Mouth shapes ──────────────────────────────────────────────────────────────

function _drawMouth(
  cmds: DrawCommand[],
  cx: number, mouthY: number, mouthW: number, px: number,
  emotion: AvatarEmotion, t: number,
  color: string, alpha: number,
): void {
  switch (emotion) {
    case 'idle': {
      _px(cmds, cx, mouthY, mouthW, px * 0.75, color, alpha * 0.8);
      break;
    }
    case 'taunt': {
      // U-shape grin
      _px(cmds, cx - mouthW * 0.5 + px * 0.5, mouthY - px * 0.5, px, px * 2.5, color, alpha);
      _px(cmds, cx + mouthW * 0.5 - px * 0.5, mouthY - px * 0.5, px, px * 2.5, color, alpha);
      _px(cmds, cx, mouthY + px * 0.8, mouthW, px, color, alpha);
      break;
    }
    case 'flinch': {
      // Zigzag grimace: 5 alternating-height segments
      const nz = 5, sw = mouthW / nz;
      for (let i = 0; i < nz; i++) {
        _px(cmds,
          cx - mouthW / 2 + (i + 0.5) * sw,
          mouthY + (i % 2 === 0 ? 0 : px * 1.4),
          sw - px * 0.25, px * 0.75, color, alpha * 0.9);
      }
      break;
    }
    case 'near_death': {
      // Frown (inverted U)
      _px(cmds, cx - mouthW * 0.35 + px * 0.5, mouthY - px * 0.8, px, px * 2, color, alpha);
      _px(cmds, cx + mouthW * 0.35 - px * 0.5, mouthY - px * 0.8, px, px * 2, color, alpha);
      _px(cmds, cx, mouthY - px * 1.8, mouthW * 0.7, px, color, alpha);
      break;
    }
    case 'victory': {
      // Open O mouth
      cmds.push({
        kind: 'arc', cx, cy: mouthY,
        r: mouthW * 0.38, a0: 0, a1: Math.PI * 2,
        stroke: color, lineWidth: px * 1.2, alpha,
      } as any);
      break;
    }
    case 'powerup': {
      // Wide grin with tooth highlights
      _px(cmds, cx - mouthW * 0.5 + px * 0.5, mouthY - px * 0.4, px, px * 2, color, alpha);
      _px(cmds, cx + mouthW * 0.5 - px * 0.5, mouthY - px * 0.4, px, px * 2, color, alpha);
      _px(cmds, cx, mouthY + px * 0.7, mouthW * 1.05, px, color, alpha);
      _px(cmds, cx - px * 1.5, mouthY + px * 0.7, px * 2, px * 0.65, '#ffffff', alpha * 0.45);
      _px(cmds, cx + px * 1.5, mouthY + px * 0.7, px * 2, px * 0.65, '#ffffff', alpha * 0.45);
      break;
    }
    case 'dead': {
      // Dim wavy flatline
      const nd = 4, ds = mouthW / nd;
      for (let i = 0; i < nd; i++) {
        _px(cmds, cx - mouthW / 2 + (i + 0.5) * ds, mouthY + (i % 2 === 0 ? 0 : px), ds - 1, px * 0.5, color, alpha * 0.4);
      }
      break;
    }
    case 'entrance': {
      const scale = Math.min(1, t / 700);
      _px(cmds, cx, mouthY, mouthW * scale, px * 0.75, color, alpha * scale);
      break;
    }
    default:
      break;
  }
}

// ── Bezel corners ─────────────────────────────────────────────────────────────

function _drawCorners(
  cmds: DrawCommand[],
  cx: number, cy: number, half: number,
  color: string, alpha: number,
): void {
  const arm = 12;
  const corners: [number, number, number, number][] = [
    [-1, -1,  1,  1],
    [-1,  1,  1, -1],
    [ 1, -1, -1,  1],
    [ 1,  1, -1, -1],
  ];
  for (const [dx, dy, sx, sy] of corners) {
    const bx = cx + dx * half;
    const by = cy + dy * half;
    cmds.push({ kind: 'line', x1: bx, y1: by, x2: bx + sx * arm, y2: by,             stroke: color, lineWidth: 2, alpha } as any);
    cmds.push({ kind: 'line', x1: bx, y1: by, x2: bx,             y2: by + sy * arm, stroke: color, lineWidth: 2, alpha } as any);
  }
}

// ── Pixel-block helper ────────────────────────────────────────────────────────

/** Draws a centered filled rectangle (the "pixel" of our pixel-art face). */
function _px(
  cmds: DrawCommand[],
  x: number, y: number, w: number, h: number,
  fill: string, alpha: number,
): void {
  cmds.push({ kind: 'rect', x: x - w / 2, y: y - h / 2, w, h, fill, alpha } as any);
}
