// src/render/renderScene.ts
import type { Scene, DrawCommand } from './drawModel';

export function renderScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  for (const cmd of scene.commands) paint(ctx, cmd);
}

function paint(ctx: CanvasRenderingContext2D, cmd: DrawCommand): void {
  switch (cmd.kind) {
    case 'circle': {
      ctx.save();
      if ((cmd as any).alpha != null) ctx.globalAlpha = (cmd as any).alpha as number;
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
      ctx.beginPath();
      ctx.lineWidth = cmd.lineWidth ?? 1;
      ctx.strokeStyle = cssVar(ctx, cmd.stroke ?? '#000');
      ctx.moveTo(cmd.x1, cmd.y1);
      ctx.lineTo(cmd.x2, cmd.y2);
      ctx.stroke();
      break;
    }
    case 'text': {
      ctx.fillStyle = '#000';
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
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (cmd.close !== false) ctx.closePath();
      ctx.lineWidth = cmd.lineWidth ?? 1;
      ctx.strokeStyle = cssVar(ctx, cmd.stroke ?? '#000');
      ctx.stroke();
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
