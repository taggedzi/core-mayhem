// src/render/renderScene.ts
import type { Scene, DrawCommand } from './drawModel';

export function renderScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  ctx.save();
  if (typeof (scene as any).tx === 'number' || typeof (scene as any).ty === 'number') {
    const tx = (scene as any).tx ?? 0;
    const ty = (scene as any).ty ?? 0;
    if (tx || ty) ctx.translate(tx, ty);
  }
  for (const cmd of scene.commands) paint(ctx, cmd);
  ctx.restore();
}

function paint(ctx: CanvasRenderingContext2D, cmd: DrawCommand): void {
  switch (cmd.kind) {
    case 'circle': {
      ctx.save();
      if ((cmd as any).alpha != null) ctx.globalAlpha = (cmd as any).alpha as number;
      if ((cmd as any).composite) ctx.globalCompositeOperation = (cmd as any).composite as GlobalCompositeOperation;
      if ((cmd as any).shadowBlur != null) ctx.shadowBlur = (cmd as any).shadowBlur as number;
      if ((cmd as any).shadowColor) ctx.shadowColor = cssVar(ctx, (cmd as any).shadowColor as string);
      ctx.beginPath();
      ctx.arc(cmd.x, cmd.y, cmd.r, 0, Math.PI * 2);
      if (cmd.fill) {
        ctx.fillStyle = cssVar(ctx, cmd.fill);
        ctx.fill();
      }
      if (cmd.stroke) {
        ctx.lineWidth = cmd.lineWidth ?? 1;
        ctx.strokeStyle = cssVar(ctx, cmd.stroke);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'line': {
      ctx.save();
      if ((cmd as any).alpha != null) ctx.globalAlpha = (cmd as any).alpha as number;
      if ((cmd as any).lineDash) ctx.setLineDash((cmd as any).lineDash as number[]);
      if ((cmd as any).lineDashOffset != null)
        ctx.lineDashOffset = (cmd as any).lineDashOffset as number;
      if ((cmd as any).lineCap) ctx.lineCap = (cmd as any).lineCap as CanvasLineCap;
      if ((cmd as any).composite) ctx.globalCompositeOperation = (cmd as any).composite as GlobalCompositeOperation;
      if ((cmd as any).shadowBlur != null) ctx.shadowBlur = (cmd as any).shadowBlur as number;
      if ((cmd as any).shadowColor) ctx.shadowColor = cssVar(ctx, (cmd as any).shadowColor as string);
      ctx.beginPath();
      ctx.lineWidth = cmd.lineWidth ?? 1;
      ctx.strokeStyle = cssVar(ctx, cmd.stroke ?? '#000');
      ctx.moveTo(cmd.x1, cmd.y1);
      ctx.lineTo(cmd.x2, cmd.y2);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'text': {
      ctx.save();
      if ((cmd as any).alpha != null) ctx.globalAlpha = (cmd as any).alpha as number;
      if ((cmd as any).composite) ctx.globalCompositeOperation = (cmd as any).composite as GlobalCompositeOperation;
      if ((cmd as any).shadowBlur != null) ctx.shadowBlur = (cmd as any).shadowBlur as number;
      if ((cmd as any).shadowColor) ctx.shadowColor = cssVar(ctx, (cmd as any).shadowColor as string);
      if ((cmd as any).font) ctx.font = resolveFontVars((cmd as any).font as string);
      if ((cmd as any).align) ctx.textAlign = (cmd as any).align as CanvasTextAlign;
      if ((cmd as any).baseline) ctx.textBaseline = (cmd as any).baseline as CanvasTextBaseline;
      const maxW = (cmd as any).maxWidth as number | undefined;
      const rot = (cmd as any).rot as number | undefined;
      const ox = (cmd as any).ox as number | undefined;
      const oy = (cmd as any).oy as number | undefined;
      if (rot) {
        ctx.translate(ox ?? cmd.x, oy ?? cmd.y);
        ctx.rotate(rot);
      }
      if ((cmd as any).stroke) {
        ctx.lineWidth = (cmd as any).strokeWidth ?? 1;
        ctx.strokeStyle = cssVar(ctx, (cmd as any).stroke as string);
        const dx = rot ? (cmd.x - (ox ?? cmd.x)) : cmd.x;
        const dy = rot ? (cmd.y - (oy ?? cmd.y)) : cmd.y;
        if (maxW != null) ctx.strokeText(cmd.text, dx, dy, maxW);
        else ctx.strokeText(cmd.text, dx, dy);
      }
      ctx.fillStyle = cssVar(ctx, (cmd as any).fill ?? '#000');
      {
        const dx = rot ? (cmd.x - (ox ?? cmd.x)) : cmd.x;
        const dy = rot ? (cmd.y - (oy ?? cmd.y)) : cmd.y;
        if (maxW != null) ctx.fillText(cmd.text, dx, dy, maxW);
        else ctx.fillText(cmd.text, dx, dy);
      }
      ctx.restore();
      break;
    }
    case 'wedge': {
      ctx.save();
      if (cmd.alpha != null) ctx.globalAlpha = cmd.alpha;
      ctx.beginPath();
      ctx.arc(cmd.cx, cmd.cy, cmd.r1, cmd.a0, cmd.a1, false);
      ctx.arc(cmd.cx, cmd.cy, cmd.r0, cmd.a1, cmd.a0, true);
      ctx.closePath();

      if (cmd.fill) {
        ctx.fillStyle = cssVar(ctx, cmd.fill);
        ctx.fill();
      }
      if (cmd.stroke) {
        ctx.lineWidth = cmd.lineWidth ?? 1;
        ctx.strokeStyle = cssVar(ctx, cmd.stroke);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'poly': {
      const pts = cmd.points;
      if (!pts.length) break;
      ctx.save();
      if ((cmd as any).alpha != null) ctx.globalAlpha = (cmd as any).alpha as number;
      if ((cmd as any).composite) ctx.globalCompositeOperation = (cmd as any).composite as GlobalCompositeOperation;
      if ((cmd as any).shadowBlur != null) ctx.shadowBlur = (cmd as any).shadowBlur as number;
      if ((cmd as any).shadowColor) ctx.shadowColor = cssVar(ctx, (cmd as any).shadowColor as string);
      ctx.beginPath();
      const p0 = pts[0]!;
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i]!;
        ctx.lineTo(p.x, p.y);
      }
      if (cmd.close !== false) ctx.closePath();
      if ((cmd as any).fill) {
        ctx.fillStyle = cssVar(ctx, (cmd as any).fill as string);
        ctx.fill();
      }
      if (cmd.stroke) {
        ctx.lineWidth = cmd.lineWidth ?? 1;
        ctx.strokeStyle = cssVar(ctx, cmd.stroke);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'arc': {
      ctx.save();
      if ((cmd as any).alpha != null) ctx.globalAlpha = (cmd as any).alpha as number;
      if ((cmd as any).composite) ctx.globalCompositeOperation = (cmd as any).composite as GlobalCompositeOperation;
      if ((cmd as any).shadowBlur != null) ctx.shadowBlur = (cmd as any).shadowBlur as number;
      if ((cmd as any).shadowColor) ctx.shadowColor = cssVar(ctx, (cmd as any).shadowColor as string);
      ctx.beginPath();
      ctx.lineWidth = cmd.lineWidth ?? 1;
      ctx.strokeStyle = cssVar(ctx, cmd.stroke ?? '#000');
      ctx.arc(cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, !!(cmd as any).ccw);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'path': {
      const pts = cmd.points;
      if (!pts.length) break;
      ctx.save();
      if ((cmd as any).alpha != null) ctx.globalAlpha = (cmd as any).alpha as number;
      if ((cmd as any).composite) ctx.globalCompositeOperation = (cmd as any).composite as GlobalCompositeOperation;
      if ((cmd as any).shadowBlur != null) ctx.shadowBlur = (cmd as any).shadowBlur as number;
      if ((cmd as any).shadowColor) ctx.shadowColor = cssVar(ctx, (cmd as any).shadowColor as string);
      ctx.beginPath();
      const q0 = pts[0]!;
      ctx.moveTo(q0.x, q0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i]!;
        ctx.lineTo(p.x, p.y);
      }
      ctx.lineWidth = cmd.lineWidth ?? 1;
      ctx.strokeStyle = cssVar(ctx, cmd.stroke ?? '#000');
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'rect': {
      ctx.save();
      if ((cmd as any).alpha != null) ctx.globalAlpha = (cmd as any).alpha as number;
      ctx.fillStyle = cssVar(ctx, (cmd as any).fill ?? '#000');
      ctx.fillRect((cmd as any).x, (cmd as any).y, (cmd as any).w, (cmd as any).h);
      ctx.restore();
      break;
    }
    case 'textBox': {
      ctx.save();
      if ((cmd as any).alpha != null) ctx.globalAlpha = (cmd as any).alpha as number;
      const font = (cmd as any).font ? resolveFontVars((cmd as any).font as string) : ctx.font;
      if (font) ctx.font = font;
      const text = (cmd as any).text as string;
      const mx = ctx.measureText(text);
      const padX = ((cmd as any).padX as number | undefined) ?? 10;
      const padY = ((cmd as any).padY as number | undefined) ?? 4;
      const textW = mx.width;
      const fontSize = (() => {
        const m = /([0-9]+\.?[0-9]*)px/.exec(font || '');
        return m ? parseFloat(m[1]!) : 14;
      })();
      const textH = (mx.actualBoundingBoxAscent ?? fontSize * 0.8) + (mx.actualBoundingBoxDescent ?? fontSize * 0.2);
      const w = textW + padX * 2;
      const h = textH + padY * 2;
      const anchor = ((cmd as any).anchor as 'center' | 'bl' | 'br' | undefined) ?? 'center';
      let x0: number;
      let y0: number;
      if (anchor === 'bl') {
        // x,y is bottom-left of box in canvas coords
        x0 = (cmd as any).x;
        y0 = (cmd as any).y - h;
      } else if (anchor === 'br') {
        // x,y is bottom-right of box in canvas coords
        x0 = (cmd as any).x - w;
        y0 = (cmd as any).y - h;
      } else {
        // default center
        x0 = (cmd as any).x - w / 2;
        y0 = (cmd as any).y - h / 2;
      }
      if ((cmd as any).fill) {
        ctx.fillStyle = cssVar(ctx, (cmd as any).fill as string);
        ctx.fillRect(x0, y0, w, h);
      }
      if ((cmd as any).stroke) {
        ctx.lineWidth = (cmd as any).lineWidth ?? 1;
        ctx.strokeStyle = cssVar(ctx, (cmd as any).stroke as string);
        ctx.strokeRect(x0, y0, w, h);
      }
      // Draw text centered within the box regardless of anchor
      const cx = (anchor === 'bl' || anchor === 'br') ? x0 + w / 2 : (cmd as any).x;
      const cy = (anchor === 'bl' || anchor === 'br') ? y0 + h / 2 : (cmd as any).y;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = cssVar(ctx, (cmd as any).textFill ?? '#fff');
      ctx.fillText(text, cx, cy);
      ctx.restore();
      break;
    }
    case 'richTextBox': {
      ctx.save();
      if ((cmd as any).alpha != null) ctx.globalAlpha = (cmd as any).alpha as number;
      const font = (cmd as any).font ? resolveFontVars((cmd as any).font as string) : ctx.font;
      if (font) ctx.font = font;
      const padX = ((cmd as any).padX as number | undefined) ?? 10;
      const padY = ((cmd as any).padY as number | undefined) ?? 4;
      const segs = (cmd as any).segments as { text: string; fill?: string; opacity?: number }[];
      // measure
      let totalW = 0;
      let maxAscent = 0;
      let maxDescent = 0;
      for (const s of segs) {
        const m = ctx.measureText(s.text);
        totalW += m.width;
        maxAscent = Math.max(maxAscent, (m.actualBoundingBoxAscent ?? 0));
        maxDescent = Math.max(maxDescent, (m.actualBoundingBoxDescent ?? 0));
      }
      const textH = (maxAscent + maxDescent) || (() => {
        const m = /([0-9]+\.?[0-9]*)px/.exec(font || '');
        const px = m ? parseFloat(m[1]!) : 14;
        return px * 1.1;
      })();
      const w = totalW + padX * 2;
      const h = textH + padY * 2;
      const x0 = (cmd as any).x - w / 2;
      const y0 = (cmd as any).y - h / 2;
      if ((cmd as any).fill) {
        ctx.fillStyle = cssVar(ctx, (cmd as any).fill as string);
        ctx.fillRect(x0, y0, w, h);
      }
      if ((cmd as any).stroke) {
        ctx.lineWidth = (cmd as any).lineWidth ?? 1;
        ctx.strokeStyle = cssVar(ctx, (cmd as any).stroke as string);
        ctx.strokeRect(x0, y0, w, h);
      }
      // draw text segments centered horizontally
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      let cx = x0 + padX + (w - 2 * padX - totalW) / 2; // offset to center combined segments
      const cy = (cmd as any).y;
      for (const s of segs) {
        const prevAlpha = ctx.globalAlpha;
        if (s.opacity != null) ctx.globalAlpha = prevAlpha * s.opacity;
        ctx.fillStyle = cssVar(ctx, (s.fill as string) ?? (cmd as any).textFill ?? '#fff');
        ctx.fillText(s.text, cx, cy);
        const m = ctx.measureText(s.text);
        cx += m.width;
        ctx.globalAlpha = prevAlpha;
      }
      ctx.restore();
      break;
    }
    case 'gradLine': {
      ctx.save();
      if ((cmd as any).alpha != null) ctx.globalAlpha = (cmd as any).alpha as number;
      if ((cmd as any).lineCap) ctx.lineCap = (cmd as any).lineCap as CanvasLineCap;
      if ((cmd as any).composite) ctx.globalCompositeOperation = (cmd as any).composite as GlobalCompositeOperation;
      const canGrad = typeof (ctx as any).createLinearGradient === 'function';
      if (canGrad) {
        const g = ctx.createLinearGradient((cmd as any).x1, (cmd as any).y1, (cmd as any).x2, (cmd as any).y2);
        if (g && typeof (g as any).addColorStop === 'function') {
          (g as any).addColorStop(0, cssVar(ctx, (cmd as any).from as string));
          (g as any).addColorStop(1, cssVar(ctx, (cmd as any).to as string));
          ctx.strokeStyle = g as any;
        } else {
          ctx.strokeStyle = cssVar(ctx, (cmd as any).from as string);
        }
      } else {
        ctx.strokeStyle = cssVar(ctx, (cmd as any).from as string);
      }
      ctx.lineWidth = (cmd as any).lineWidth ?? 1;
      ctx.beginPath();
      ctx.moveTo((cmd as any).x1, (cmd as any).y1);
      ctx.lineTo((cmd as any).x2, (cmd as any).y2);
      ctx.stroke();
      ctx.restore();
      break;
    }
  }
}

function cssVar(_ctx: CanvasRenderingContext2D, v: string): string {
  // support CSS var tokens like 'var(--left)'
  if (v.startsWith('var(')) {
    const name = v.slice(4, -1).trim();
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';
  }
  return v;
}

// Replace any var(--name[, fallback]) tokens inside a font string with the resolved value.
function resolveFontVars(font: string): string {
  if (!font || font.indexOf('var(') === -1) return font;
  const css = getComputedStyle(document.documentElement);
  return font.replace(/var\(([^)]+)\)/g, (_, body: string) => {
    const parts = body.split(',');
    const name = (parts.shift() ?? '').trim();
    const joined = parts.join(',').trim();
    const fallback = joined !== '' ? joined : 'monospace';
    const val = css.getPropertyValue(name).trim();
    return val !== '' ? val : fallback;
  });
}
