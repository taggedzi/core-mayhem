import { audio } from '../audio';
import { AUDIO_DEFAULTS } from '../audio/config';
import { sim } from '../state';

const K = { sfx: 'cm_sfxVolume', music: 'cm_musicVolume', viz: 'cm_vizSens' } as const;

function load(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    const n = Number(v);
    if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
  } catch { /* ignore */ }
  return fallback;
}

function save(key: string, val: number): void {
  try { localStorage.setItem(key, String(val)); } catch { /* ignore */ }
}

export function initAudioControls(): void {
  const btn = document.getElementById('btnAudio') as HTMLButtonElement | null;
  if (!btn) return;

  // Create a small popover near the button
  const pop = document.createElement('div');
  pop.id = 'audioPopover';
  pop.className = 'audio-popover';
  pop.style.display = 'none';

  const row = (label: string, id: string, def: number, opts?: { min?: number; max?: number; step?: number }): HTMLInputElement => {
    const wrap = document.createElement('label');
    wrap.className = 'audio-row';
    wrap.textContent = label + ' ';
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = String(opts?.min ?? 0);
    inp.max = String(opts?.max ?? 1);
    inp.step = String(opts?.step ?? 0.05);
    inp.id = id;
    inp.value = String(def);
    wrap.appendChild(inp);
    pop.appendChild(wrap);
    return inp as HTMLInputElement;
  };

  const sfx0 = load(K.sfx, (AUDIO_DEFAULTS as any).sfxVolume ?? 1);
  const music0 = load(K.music, (AUDIO_DEFAULTS as any).musicVolume ?? 0.6);
  const viz0 = load(K.viz, 1);
  const elSfx = row('SFX', 'sfxVol', sfx0);
  const elMusic = row('Music', 'musicVol', music0);
  const elViz = row('Visualizer', 'vizSens', viz0, { min: 0, max: 2, step: 0.05 });

  document.body.appendChild(pop);

  // Apply initial volumes
  try { audio.setSfxVolume(sfx0); } catch { /* ignore */ }
  try { audio.setMusicVolume(music0); } catch { /* ignore */ }
  // Apply initial visualizer sensitivity
  (sim as any).vizSens = viz0;

  const onSfx = (): void => {
    const v = Math.min(1, Math.max(0, Number(elSfx.value)));
    try { audio.setSfxVolume(v); } catch { /* ignore */ }
    save(K.sfx, v);
  };
  const onMusic = (): void => {
    const v = Math.min(1, Math.max(0, Number(elMusic.value)));
    try { audio.setMusicVolume(v); } catch { /* ignore */ }
    save(K.music, v);
  };
  elSfx.addEventListener('input', onSfx);
  elMusic.addEventListener('input', onMusic);
  elViz.addEventListener('input', () => {
    const v = Math.min(2, Math.max(0, Number(elViz.value)));
    (sim as any).vizSens = v;
    save(K.viz, v);
  });

  const positionPopover = (): void => {
    const r = btn.getBoundingClientRect();
    // place below-right of the button
    pop.style.position = 'fixed';
    pop.style.left = `${Math.round(r.right - pop.offsetWidth)}px`;
    pop.style.top = `${Math.round(r.bottom + 6)}px`;
  };

  let open = false;
  const close = (): void => {
    open = false;
    pop.style.display = 'none';
    window.removeEventListener('resize', positionPopover);
    document.removeEventListener('click', onDocClick, true);
  };
  const onDocClick = (e: MouseEvent): void => {
    if (!open) return;
    const t = e.target as Node | null;
    if (t && (t === pop || pop.contains(t) || t === btn)) return;
    close();
  };
  const toggle = (): void => {
    open = !open;
    if (open) {
      pop.style.display = 'block';
      positionPopover();
      window.addEventListener('resize', positionPopover);
      document.addEventListener('click', onDocClick, true);
    } else {
      close();
    }
  };
  btn.addEventListener('click', (e) => { e.preventDefault(); toggle(); });
}
