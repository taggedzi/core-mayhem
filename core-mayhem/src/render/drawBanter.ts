import { sim } from '../state';

export function drawBanter(ctx: CanvasRenderingContext2D): void {
  const ui: any = (sim as any).banterUI;
  if (!ui) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const W = sim.W, H = sim.H;
  // Bubble drawer (cartoon style) with multiline + fade, anchored by top edge
  const drawBubble = (
    text: string,
    anchorX: number,
    anchorTopY: number,
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
    const outlineDark = 'rgba(10,10,16,0.95)';
    const accent = side === 'L' ? 'var(--left)' : 'var(--right)';
    const textColor = '#111';
    ctx.font = 'bold 14px Verdana, Tahoma, Geneva, sans-serif';
    const m = ctx.getTransform();
    const sx = m.a || 1;
    const sy = m.d || 1;
    // Fade in/out
    const now2 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const fadeInMs = 140;
    const fadeOutMs = 220;
    const age = Math.max(0, now2 - (t0 || now2));
    const remain = Math.max(0, (until || now2) - now2);
    const alphaIn = Math.max(0, Math.min(1, age / fadeInMs));
    const alphaOut = Math.max(0, Math.min(1, remain / fadeOutMs));
    const alpha = Math.min(alphaIn, alphaOut) || 1;

    // Word wrap in CSS px then convert to world units for drawing
    const maxPx = 220;
    const padPx = 10;
    const lineHpx = 16;
    const words = String(text).split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    const widthPx = (s: string) => ctx.measureText(s).width;
    for (const w0 of words) {
      const t = cur ? cur + ' ' + w0 : w0;
      if (widthPx(t) <= maxPx || !cur) cur = t; else { lines.push(cur); cur = w0; }
    }
    if (cur) lines.push(cur);

    const widestPx = Math.max(0, ...lines.map(widthPx));
    const w = (Math.min(maxPx, widestPx) + padPx * 2) / sx;
    const h = (lines.length * lineHpx + padPx * 2) / sy;
    let bx = anchorX - w / 2;
    let by = anchorTopY; // below core: anchor is the TOP edge of the bubble
    // Clamp inside canvas
    bx = Math.max(6, Math.min(W - w - 6, bx));
    by = Math.max(6, Math.min(H - h - 6, by));

    // Apply alpha
    ctx.globalAlpha = ctx.globalAlpha * alpha;

    // Rounded box with shadow and dual outline
    const r = 10 / Math.max(1, Math.min(sx, sy));
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + w, by, bx + w, by + h, r);
    ctx.arcTo(bx + w, by + h, bx, by + h, r);
    ctx.arcTo(bx, by + h, bx, by, r);
    ctx.arcTo(bx, by, bx + w, by, r);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.lineWidth = 3 / Math.max(1, Math.min(sx, sy));
    ctx.strokeStyle = outlineDark;
    ctx.stroke();
    ctx.lineWidth = 1.6 / Math.max(1, Math.min(sx, sy));
    ctx.strokeStyle = cssVar(ctx, accent);
    ctx.stroke();

    // Tail from bubble top toward tip
    const baseHalf = 8 / sx;
    const baseX = Math.max(bx + baseHalf, Math.min(bx + w - baseHalf, anchorX));
    const baseY = by;
    ctx.beginPath();
    ctx.moveTo(baseX - baseHalf, baseY);
    ctx.lineTo(baseX + baseHalf, baseY);
    ctx.lineTo(tipX, tipY);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.lineWidth = 3 / Math.max(1, Math.min(sx, sy));
    ctx.strokeStyle = outlineDark;
    ctx.stroke();
    ctx.lineWidth = 1.6 / Math.max(1, Math.min(sx, sy));
    ctx.strokeStyle = cssVar(ctx, accent);
    ctx.stroke();

    // Text (multiline, centered manually)
    ctx.shadowBlur = 0;
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    // const padXw = padPx / sx; // not needed since we center each line
    const padYw = padPx / sy;
    const lineHw = lineHpx / sy;
    let ty = by + padYw + lineHw; // baseline for first line
    for (const l of lines) {
      const lwpx = widthPx(l);
      const lww = lwpx / sx;
      const tx = bx + (w - lww) / 2;
      ctx.fillText(l, tx, ty);
      ty += lineHw;
    }
    ctx.restore();
  };

  // Compute anchors using core centers + ring radius so the bubble sits BELOW the core.
  const drawForSide = (side: 'L' | 'R'): void => {
    const uiSide = side === 'L' ? ui.L : ui.R;
    const core = side === 'L' ? (sim as any).coreL : (sim as any).coreR;
    if (!uiSide || !uiSide.text || now > uiSide.until || !core?.center) return;
    const cx = core.center.x;
    const cy = core.center.y;
    const r = Number(core.ringR ?? core.R ?? 40);
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r)) return;
    const m = ctx.getTransform();
    const sx = m.a || 1, sy = m.d || 1;
    const gap = 18 / sy; // vertical gap between core bottom and bubble top
    const anchorTopY = (cy + r) + gap; // below core
    const tipX = cx + (side === 'L' ? -8 / sx : 8 / sx);
    const tipY = cy + r; // bottom edge of the core ring
    drawBubble(String(uiSide.text), cx, anchorTopY, tipX, tipY, side, uiSide.t0 || now, uiSide.until || now);
  };

  drawForSide('L');
  drawForSide('R');
}

function cssVar(_ctx: CanvasRenderingContext2D, v: string): string {
  if (v.startsWith('var(')) {
    const name = v.slice(4, -1).trim();
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';
  }
  return v;
}
