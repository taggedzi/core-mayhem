import { AVATAR } from '../config';
import { sim } from '../state';

export function drawBanter(ctx: CanvasRenderingContext2D): void {
  const ui: any = (sim as any).banterUI;
  if (!ui) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const W = sim.W, H = sim.H;

  /**
   * Draw a speech bubble with the tail pointing downward toward the speaker (avatar).
   *
   * anchorX      – horizontal center of the bubble (avatar center X)
   * anchorBottomY – Y of the bubble's bottom edge (should be just above avatar top)
   * tipX, tipY   – where the tail tip points (avatar orb top)
   */
  const drawBubble = (
    text: string,
    anchorX: number,
    anchorBottomY: number,
    tipX: number,
    tipY: number,
    side: 'L' | 'R',
    t0: number,
    until: number,
  ): void => {
    if (!text) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const fillColor = 'rgba(255,255,255,0.95)';
    const outlineDark = 'rgba(10,10,16,0.90)';
    const accent = side === 'L' ? 'var(--left)' : 'var(--right)';
    const textColor = '#111';
    ctx.font = 'bold 14px Verdana, Tahoma, Geneva, sans-serif';
    const m = ctx.getTransform();
    const sx = m.a ?? 1;
    const sy = m.d ?? 1;
    const scale = Math.max(1, Math.min(sx, sy));

    // Fade in/out
    const now2 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const fadeInMs = 140;
    const fadeOutMs = 220;
    const age = Math.max(0, now2 - (t0 ?? now2));
    const remain = Math.max(0, (until ?? now2) - now2);
    const alphaIn = Math.max(0, Math.min(1, age / fadeInMs));
    const alphaOut = Math.max(0, Math.min(1, remain / fadeOutMs));
    const alpha = Math.min(alphaIn, alphaOut) || 1;
    ctx.globalAlpha = ctx.globalAlpha * alpha;

    // Word wrap
    const maxPx = 220;
    const padPx = 10;
    const lineHpx = 16;
    const words = String(text).split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    const widthPx = (s: string): number => ctx.measureText(s).width;
    for (const w0 of words) {
      const candidate = cur ? cur + ' ' + w0 : w0;
      if (widthPx(candidate) <= maxPx || !cur) cur = candidate;
      else { lines.push(cur); cur = w0; }
    }
    if (cur) lines.push(cur);

    const widestPx = Math.max(0, ...lines.map(widthPx));
    const bw = (Math.min(maxPx, widestPx) + padPx * 2) / sx;
    const bh = (lines.length * lineHpx + padPx * 2) / sy;

    // Bubble position: bottom edge at anchorBottomY, centered on anchorX
    let bx = anchorX - bw / 2;
    let by = anchorBottomY - bh;
    bx = Math.max(6 / sx, Math.min(W - bw - 6 / sx, bx));
    by = Math.max(6 / sy, Math.min(H - bh - 6 / sy, by));

    const tailBaseY = by + bh;

    // Tail geometry: a triangular tongue pointing downward
    const tailHW = 9 / sx;   // half-width of tail base
    const tailBX = Math.max(bx + tailHW * 2, Math.min(bx + bw - tailHW * 2, anchorX));

    const r = 10 / scale;

    // ── Shadow pass ────────────────────────────────────────────────────────────
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    _bubblePath(ctx, bx, by, bw, bh, r, tailBX, tailHW, tailBaseY, tipX, tipY);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── Dark outline ───────────────────────────────────────────────────────────
    ctx.lineWidth = 3 / scale;
    ctx.strokeStyle = outlineDark;
    ctx.stroke();

    // ── Accent outline ─────────────────────────────────────────────────────────
    ctx.lineWidth = 1.6 / scale;
    ctx.strokeStyle = cssVar(ctx, accent);
    ctx.stroke();

    // ── Text ──────────────────────────────────────────────────────────────────
    ctx.shadowBlur = 0;
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const padYw = padPx / sy;
    const lineHw = lineHpx / sy;
    let ty = by + padYw + lineHw;
    for (const l of lines) {
      const lww = widthPx(l) / sx;
      const tx = bx + (bw - lww) / 2;
      ctx.fillText(l, tx, ty);
      ty += lineHw;
    }
    ctx.restore();
  };

  const drawForSide = (side: 'L' | 'R'): void => {
    const uiSide = side === 'L' ? ui.L : ui.R;
    if (!uiSide || !uiSide.text || now > uiSide.until) return;

    const cfg = AVATAR as any;
    const orbR: number = cfg?.orbR ?? 52;
    const blCX: number = cfg?.left?.cx ?? 820;
    const blCY: number = cfg?.left?.cy ?? 155;
    // Bezel corners extend orbR + 37 above avatar center (matches avatar.ts _drawCorners half)
    const bezelHalf = orbR + 37;

    const avatarCX = side === 'L' ? blCX : W - blCX;
    const avatarCY = H - blCY;             // canvas Y of avatar center
    const avatarTop = avatarCY - bezelHalf; // topmost visible pixel of the avatar

    const m = ctx.getTransform();
    const sy = m.d ?? 1;
    const gap = 62 / sy;

    // Bubble sits just above the avatar; tail tip is the top of the orb
    const anchorBottomY = avatarTop - gap;
    const tipX = avatarCX;
    const tipY = avatarCY - orbR; // top of orb circle

    drawBubble(
      String(uiSide.text),
      avatarCX,
      anchorBottomY,
      tipX, tipY,
      side, uiSide.t0 ?? now, uiSide.until ?? now,
    );
  };

  drawForSide('L');
  drawForSide('R');
}

/**
 * Build a single closed path for a rounded-rectangle speech bubble with a
 * downward-pointing tail.  The tail is part of the outline so there is no
 * visible seam between the box and the tail.
 */
function _bubblePath(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, bw: number, bh: number, r: number,
  tailBX: number, tailHW: number, tailBaseY: number,
  tipX: number, tipY: number,
): void {
  // Top-left → clockwise
  ctx.moveTo(bx + r, by);
  // Top-right corner
  ctx.arcTo(bx + bw, by,      bx + bw, by + bh, r);
  // Bottom-right corner
  ctx.arcTo(bx + bw, by + bh, bx,      by + bh, r);
  // Bottom edge right section → tail right base
  ctx.lineTo(tailBX + tailHW, tailBaseY);
  // Tail: down to tip and back up
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(tailBX - tailHW, tailBaseY);
  // Bottom edge left section → bottom-left corner
  ctx.arcTo(bx, by + bh, bx, by, r);
  // Left side → top-left corner
  ctx.arcTo(bx, by,      bx + bw, by, r);
  ctx.closePath();
}

function cssVar(_ctx: CanvasRenderingContext2D, v: string): string {
  if (v.startsWith('var(')) {
    const name = v.slice(4, -1).trim();
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';
  }
  return v;
}
