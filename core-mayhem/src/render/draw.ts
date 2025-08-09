import { Composite } from 'matter-js';
import { sim } from '../state';
import { Side } from '../types';
import { WALL_T, BIN_T, BIN_INTAKE_H } from '../config';
import { WEAPON_WINDUP_MS, SHIELD_RING_PX } from '../config';
import {
  CORE_RIM_WIDTH_R,
  SHIELD_RING_WIDTH_R,
  SHIELD_RING_GLOW,
  SHIELD_RING_COLOR,
} from '../config';
import { GAMEOVER } from '../config';

const SHOW_DAMPERS = true; // set false later to hide them entirely
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function drawFrame(ctx:CanvasRenderingContext2D){
  const W=sim.W,H=sim.H;
  ctx.clearRect(0,0,W,H);

  // midline
  ctx.setLineDash([6,6]);
  ctx.strokeStyle="#20336e";
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(W/2,0);
  ctx.lineTo(W/2,H);
  ctx.stroke();
  ctx.setLineDash([]);

  // dampers (faint outline only)
  if (SHOW_DAMPERS) {
    for (const g of sim.gels) {
      const b = g.bounds;
      ctx.save();
      ctx.setLineDash([2, 10]);        // thin dash
      ctx.lineWidth = 0.6;             // thinner line
      ctx.strokeStyle = 'rgba(0,255,213,0.12)'; // low opacity
      ctx.strokeRect(b.min.x, b.min.y, b.max.x - b.min.x, b.max.y - b.min.y);
      ctx.restore();
    }
  }

  // pins (filled dots)
  ctx.fillStyle='#2b3a78';
  Composite.allBodies(sim.world).forEach(b=>{
    const k=(b as any).plugin?.kind;
    if(k==='pin'){
      ctx.beginPath();
      ctx.arc(b.position.x,b.position.y,b.circleRadius,0,Math.PI*2);
      ctx.fill();
    }
  });

  // rotors (thin outlines)
  ctx.strokeStyle='#2b3a78';
  ctx.lineWidth=2;
  Composite.allBodies(sim.world).forEach(b=>{
    const k=(b as any).plugin?.kind;
    if(k==='rotor'){
      const v=b.vertices;
      ctx.beginPath();
      ctx.moveTo(v[0].x,v[0].y);
      for(let i=1;i<v.length;i++) ctx.lineTo(v[i].x,v[i].y);
      ctx.closePath();
      ctx.stroke();
    }
  });

  // pipe walls as single vertical strokes
  Composite.allBodies(sim.world).forEach(b=>{
    const k=(b as any).plugin?.kind;
    if (k === 'pipeWall') {
      const m = b.bounds;
      const cx = (m.min.x + m.max.x) * 0.5; // centerline of skinny rectangle
      ctx.save();
      ctx.lineWidth = WALL_T;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#3558b6';
      ctx.beginPath();
      ctx.moveTo(cx, m.min.y);
      ctx.lineTo(cx, m.max.y);
      ctx.stroke();
      ctx.restore();
    }
  });

  // optional: intake visual (dashed box)
  Composite.allBodies(sim.world).forEach(b=>{
    const k=(b as any).plugin?.kind;
    if (k === 'intake') {
      const m = b.bounds;
      ctx.save();
      ctx.setLineDash([4,4]);
      ctx.strokeStyle = '#44ffd5';
      ctx.strokeRect(m.min.x, m.min.y, m.max.x - m.min.x, m.max.y - m.min.y);
      ctx.restore();
    }
  });

  // flippers (as strokes)
  sim.flippers.forEach(f=>{
    ctx.save();
    ctx.strokeStyle = '#9fb8ff';
    ctx.lineWidth = 6; // separate control; set to WALL_T if you want global match
    ctx.beginPath();
    ctx.moveTo(f.bounds.min.x,f.position.y);
    ctx.lineTo(f.bounds.max.x,f.position.y);
    ctx.stroke();
    ctx.restore();
  });

  // lane walls as single vertical strokes
  Composite.allBodies(sim.world).forEach(b=>{
    const k = (b as any).plugin?.kind;
    if (k === 'laneWall') {
      const m = b.bounds;
      const cx = (m.min.x + m.max.x) * 0.5;
      const c = getCSS('--line') || '#88aaff';
      ctx.save();
      ctx.lineWidth = WALL_T;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.moveTo(cx, m.min.y);
      ctx.lineTo(cx, m.max.y);
      ctx.stroke();
      ctx.restore();
    }
    // NOTE: we intentionally do NOT draw laneDamp here; it's already shown faint above.
  });

  // paddles
  ctx.strokeStyle='#2b3a78';
  ctx.lineWidth=8;
  sim.paddles.forEach(p=>{
    ctx.beginPath();
    ctx.moveTo(p.bounds.min.x,p.position.y);
    ctx.lineTo(p.bounds.max.x,p.position.y);
    ctx.stroke();
  });

  // bins
  drawBins(ctx, sim.binsL, getCSS('--left'));
  drawBins(ctx, sim.binsR, getCSS('--right'));

  // cores
  drawCore(ctx, sim.coreL);
  drawCore(ctx, sim.coreR);
  drawShieldRing(ctx, sim.coreL, css('--left'));
  drawShieldRing(ctx, sim.coreR, css('--right'));
  drawCoreStats(ctx, sim.coreL, css('--left'));
  drawCoreStats(ctx, sim.coreR, css('--right'));

  // weapon mount icons
  drawWeaponMounts(ctx, (sim as any).wepL, getCSS('--left'));
  drawWeaponMounts(ctx, (sim as any).wepR, getCSS('--right'));

  // Wind-up flashes on weapon mounts
  const t = performance.now();
  sim.fxArm = sim.fxArm.filter(fx => fx.until > t);
  sim.fxArm.forEach(fx => {
    const left = (fx.until - t) / WEAPON_WINDUP_MS; // 1 → 0 over the windup window
    const pulse = 0.5 + 0.5 * Math.sin((1 - left) * Math.PI * 2.5);
    const r0 = 10, r1 = 16;
    const r = r0 + (1 - left) * (r1 - r0);
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.45 * pulse;
    ctx.strokeStyle = fx.color || getCSS('--accent');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // ammo & projectiles
  Composite.allBodies(sim.world).forEach(b=>{
    const plug=(b as any).plugin;
    if(!plug) return;
    if(plug.kind==='ammo'){
      const col= colorForAmmo(plug.type);
      ctx.beginPath();
      ctx.arc(b.position.x,b.position.y,b.circleRadius||6,0,Math.PI*2);
      ctx.fillStyle=col; ctx.fill();
    }
  });
  
  renderProjectiles(ctx);
  renderSweep(ctx);
  renderBeams(ctx);
  renderImpactFX(ctx);
  drawGameOverBanner(ctx);
}

function drawBins(ctx: CanvasRenderingContext2D, bins: any, color: string) {
  Object.values(bins).forEach((bin: any) => {
    const m = bin.body.bounds;
    const x = m.min.x, y = m.min.y, w = m.max.x - m.min.x, h = m.max.y - m.min.y;

    // outline only (thin)
    ctx.lineWidth = BIN_T;
    ctx.strokeStyle = color;
    ctx.strokeRect(x, y, w, h);

    // fill bar inside
    const pct = Math.max(0, Math.min(1, bin.fill / bin.cap));
    const pad = 3;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = color;
    ctx.fillRect(x + pad, y + pad, (w - pad * 2) * pct, h - pad * 2);
    ctx.restore();

    // visible intake strip (from intake sensor bounds if present)
    const ib = bin.intake?.bounds;
    const ix = ib ? ib.min.x : x + w * 0.04;
    const iy = ib ? ib.min.y : y - BIN_INTAKE_H;
    const iw = ib ? (ib.max.x - ib.min.x) : w * 0.92;
    const ih = ib ? (ib.max.y - ib.min.y) : BIN_INTAKE_H;

    ctx.save();
    ctx.fillStyle = 'rgba(0,255,213,0.25)';
    ctx.fillRect(ix, iy, iw, ih);
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,255,213,0.35)';
    ctx.strokeRect(ix, iy, iw, ih);
    ctx.restore();
    ctx.setLineDash([]); // hygiene

    // --- labels (centered, two lines, clipped to bin width) ---
    const label = String(bin.label).toUpperCase();
    const count = `${Math.floor(bin.fill)}/${bin.cap}`;

    const textTop = y + h + 2;
    const lineH = 11; // pixels between lines

    ctx.save();
    // clip so long labels don't bleed into neighbors
    ctx.beginPath();
    ctx.rect(x, textTop - 1, w, lineH * 2 + 4);
    ctx.clip();

    ctx.textAlign = 'center';

    // label line
    ctx.textBaseline = 'top';
    ctx.font = '10px Verdana';
    ctx.fillStyle = '#cfe6ff';
    ctx.fillText(label, x + w / 2, textTop);

    // count line (second line)
    ctx.textBaseline = 'top';
    ctx.font = '10px Verdana';
    ctx.fillStyle = '#9fb8ff';
    ctx.fillText(count, x + w / 2, textTop + lineH);

    ctx.restore();
  });
}

function drawCore(ctx:CanvasRenderingContext2D, core:any){
  const x=core.center.x,y=core.center.y,R=core.radius;

  // --- Team rim only when shields are DOWN ---
  if ((core.shield || 0) <= 0) {
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

  const n=core.segHP.length, step=Math.PI*2/n;
  for(let i=0;i<n;i++){
    const hp=core.segHP[i];
    const t=hp/core.segHPmax;
    const a0=i*step+core.rot-0.04, a1=(i+1)*step+core.rot+0.04;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.arc(x,y,R*0.86,a0,a1); ctx.closePath();
    ctx.fillStyle= i%2? '#0e1730':'#0b1227'; ctx.fill();
    if(t>0){
      ctx.save(); ctx.globalAlpha=.15 + .75*t;
      ctx.fillStyle=getCSS(core.side<0?'--left':'--right');
      ctx.beginPath(); ctx.moveTo(x,y); ctx.arc(x,y,R*0.86,a0,a1); ctx.closePath();
      ctx.fill(); ctx.restore();
    }
  }
  ctx.beginPath(); ctx.arc(x,y,R*0.34,0,Math.PI*2);
  ctx.fillStyle='#091125'; ctx.fill();
  ctx.lineWidth=3; ctx.strokeStyle=getCSS(core.side<0?'--left':'--right'); ctx.stroke();
}

function drawWeaponMounts(ctx: CanvasRenderingContext2D, wep: any, color: string) {
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
    ctx.fillStyle = '#0a1227'; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = color; ctx.fillText(label, pos.x - 3, pos.y + 3);
  });
}

function colorForAmmo(t:string){
  if(t==='heavy') return '#ffca1a';
  if(t==='volatile') return '#ff3d3d';
  if(t==='emp') return '#00ffd5';
  if(t==='repair') return '#6bffb8';
  if(t==='shield') return '#9fc5ff';
  return '#b6ff00';
}
function getCSS(name:string){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

// ---- helpers: projectile rendering + impact FX ----
function renderProjectiles(ctx: CanvasRenderingContext2D) {
  const bodies = Composite.allBodies(sim.world);
  for (const b of bodies) {
    const plug = (b as any).plugin;
    if (!plug || plug.kind !== 'projectile') continue;

    const p = b.position;
    const v = (b as any).velocity || { x: 0, y: 0 };
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
      default: { // cannon
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

function renderImpactFX(ctx: CanvasRenderingContext2D) {
  (sim as any).fxImp ||= [];
  const now = performance.now();
  // keep only active FX
  sim.fxImp = sim.fxImp.filter(f => now - f.t0 < f.ms);

  for (const f of sim.fxImp) {
    const age = now - f.t0;
    const t = Math.max(0, Math.min(1, age / f.ms)); // 0..1

    if (f.kind === 'burst') {
      // ---- SHOCKWAVE RING ----
      const baseR = 8;
      const maxR  = 48;                 // how big the wave gets; tweak if you like
      const r     = baseR + (maxR - baseR) * t;

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


function renderBeams(ctx: CanvasRenderingContext2D) {
  (sim as any).fxBeam ||= [];
  const now = performance.now();
  // keep active beams only
  sim.fxBeam = sim.fxBeam.filter(b => now - b.t0 < b.ms);

  for (const b of sim.fxBeam) {
    const t = (now - b.t0) / b.ms;            // 0..1
    const alpha = 0.65 * (1 - t) + 0.15;      // fades
    const w = 3 + 2 * Math.sin(t * Math.PI);  // pulses a bit
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

function renderSweep(ctx: CanvasRenderingContext2D) {
  (sim as any).fxSweep ||= [];
  const now = performance.now();
  // keep ones still within their ms window
  sim.fxSweep = sim.fxSweep.filter(s => now - s.t0 < s.ms);

  for (const s of sim.fxSweep) {
    const t = (now - s.t0) / s.ms;        // 0..1
    const color = s.side < 0 ? css('--left') : css('--right');
    const a = s.a0 + t * (s.a1 - s.a0);   // pointer angle along the arc
    const r = 20;                         // radius of the sweep arc

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

function drawCoreStats(ctx: CanvasRenderingContext2D, core: any, color: string) {
  if (!core?.center) return;
  const { x, y } = core.center;

  // font size that scales a bit with canvas height
  const fs1 = Math.max(12, Math.min(18, sim.H * 0.024)); // HP line
  const fs2 = Math.max(10, Math.min(14, sim.H * 0.018)); // Shield line

  // integers for HP; shield as integer too (tweak to show 1 decimal if you prefer)
  const hp = Math.max(0, Math.round(core.centerHP || 0));
  const sh = Math.max(0, Math.round(core.shield || 0));

  // subtle dark backdrop for readability (doesn't block physics; just a visual)
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(x, y, Math.max(18, sim.H * 0.03), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // text (outline for contrast)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // HP (top line)
  ctx.font = `bold ${fs1}px Verdana`;
  // outline
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(String(hp), x, y - fs2 * 0.55);
  // fill
  ctx.fillStyle = '#fff';
  ctx.fillText(String(hp), x, y - fs2 * 0.55);

  // Shield (bottom line) — dimmer if zero
  const shieldText = `S:${sh}`;
  ctx.font = `bold ${fs2}px Verdana`;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(shieldText, x, y + fs2 * 0.75);
  ctx.fillStyle = sh > 0 ? color : '#9aa3b2';
  ctx.fillText(shieldText, x, y + fs2 * 0.75);
}

function coreRadius(c: any) {
  return c?.outerR ?? c?.R ?? c?.radius ?? c?.ringR ?? Math.max(36, sim.H * 0.09);
}

function drawShieldRing(
  ctx: CanvasRenderingContext2D,
  core: any,
  colorOverride?: string // ← backward-compatible, optional
) {
  const shield = core?.shield || 0;
  if (shield <= 0 || !core?.center) return;

  const R  = coreRadius(core);
  const w  = SHIELD_RING_WIDTH_R * R;
  const cx = core.center.x, cy = core.center.y;

  const pct = Math.max(0, Math.min(1, core.shieldMax ? shield / core.shieldMax : shield / 3));

  // Choose color: override → team css → fallback constant
  const teamCssName = core.side < 0 ? '--left' : '--right';
  const teamFromCss =
    (typeof getCSS === 'function' ? getCSS(teamCssName)?.trim() :
     (typeof css === 'function' ? css(teamCssName)?.trim() : '')) || '';
  const color = (colorOverride || teamFromCss || SHIELD_RING_COLOR);

  ctx.save();
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35 + 0.65 * pct;

  ctx.shadowColor = color;
  ctx.shadowBlur  = SHIELD_RING_GLOW;

  // (optional) dash animation:
  // ctx.setLineDash([16, 10]);
  // ctx.lineDashOffset = -(performance.now() * 0.03);

  ctx.beginPath();
  ctx.arc(cx, cy, R + w * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawGameOverBanner(ctx: CanvasRenderingContext2D) {
  if (!(sim as any).gameOver) return;

  const winner = (sim as any).winner as Side | 0;
  const msg = winner === 0 ? 'STALEMATE' : (winner === -1 ? 'LEFT WINS' : 'RIGHT WINS');

  const now = performance.now();
  const t0  = (sim as any).winnerAt || now;
  const remainMs = Math.max(0, GAMEOVER.bannerMs - (now - t0));
  const remainSec = Math.ceil(remainMs / 1000);

  // banner box
  const bw = Math.min(sim.W * 0.8, 720);
  const bh = Math.min(sim.H * 0.22, 180);
  const x  = (sim.W - bw) / 2;
  const y  = (sim.H - bh) / 2;

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
