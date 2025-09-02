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
      if ((cmd as any).font) ctx.font = (cmd as any).font as string;
      if ((cmd as any).align) ctx.textAlign = (cmd as any).align as CanvasTextAlign;
      if ((cmd as any).baseline) ctx.textBaseline = (cmd as any).baseline as CanvasTextBaseline;
      if ((cmd as any).stroke) {
        ctx.lineWidth = (cmd as any).strokeWidth ?? 1;
        ctx.strokeStyle = cssVar(ctx, (cmd as any).stroke as string);
        ctx.strokeText(cmd.text, cmd.x, cmd.y);
      }
      ctx.fillStyle = cssVar(ctx, (cmd as any).fill ?? '#000');
      ctx.fillText(cmd.text, cmd.x, cmd.y);
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
    case 'vignette': {
      ctx.save();
      try {
        const r0 = (cmd as any).r0 as number;
        const r1 = (cmd as any).r1 as number;
        const alpha = ((cmd as any).alpha as number) ?? 0.5;
        const color = (cmd as any).color ?? 'rgba(0,0,0,1)';
        const g = (typeof (ctx as any).createRadialGradient === 'function')
          ? ctx.createRadialGradient(cmd.cx, cmd.cy, Math.max(0, r0), cmd.cx, cmd.cy, Math.max(r0 + 1, r1))
          : null;
        if (g && typeof (g as any).addColorStop === 'function') {
          g.addColorStop(0, 'rgba(0,0,0,0)');
          const outer = cssVar(ctx, color);
          ctx.globalAlpha = alpha;
          (g as any).addColorStop(1, outer);
          ctx.fillStyle = g as any;
          ctx.fillRect(0, 0, (ctx.canvas as HTMLCanvasElement).width, (ctx.canvas as HTMLCanvasElement).height);
        } else {
          // Fallback: uniform translucent overlay
          ctx.globalAlpha = (((cmd as any).alpha as number) ?? 0.25) * 0.35;
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, (ctx.canvas as HTMLCanvasElement).width, (ctx.canvas as HTMLCanvasElement).height);
        }
      } catch {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, (ctx.canvas as HTMLCanvasElement).width, (ctx.canvas as HTMLCanvasElement).height);
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
