import { audio } from '../audio';
import { AUDIO_DEFAULTS } from '../audio/config';
import { sim } from '../state';
import { announcerControls } from '../announcer';

const K = { sfx: 'cm_sfxVolume', music: 'cm_musicVolume', viz: 'cm_vizSens', beat: 'cm_beatSens', chip: 'cm_chipMode',
  annVol: 'cm_announcerVol', annDuckM: 'cm_annDuckMusic', annDuckS: 'cm_annDuckSfx', annRel: 'cm_annDuckRelease', annGap: 'cm_annMinGap', annOn: 'cm_annEnabled' } as const;

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

  const selectRow = (label: string, id: string, options: { value: string; label: string }[], def: string): HTMLSelectElement => {
    const wrap = document.createElement('label');
    wrap.className = 'audio-row';
    wrap.textContent = label + ' ';
    const sel = document.createElement('select');
    sel.id = id;
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.value; opt.text = o.label;
      if (o.value === def) opt.selected = true;
      sel.appendChild(opt);
    }
    wrap.appendChild(sel);
    pop.appendChild(wrap);
    return sel;
  };

  const buttonRow = (): { prev: HTMLButtonElement; next: HTMLButtonElement } => {
    const wrap = document.createElement('div');
    wrap.className = 'audio-row buttons';
    const prev = document.createElement('button');
    prev.type = 'button'; prev.textContent = '⟨ Prev';
    const next = document.createElement('button');
    next.type = 'button'; next.textContent = 'Next ⟩';
    wrap.append(prev, next);
    pop.appendChild(wrap);
    return { prev, next };
  };

  const sfx0 = load(K.sfx, (AUDIO_DEFAULTS as any).sfxVolume ?? 1);
  const music0 = load(K.music, (AUDIO_DEFAULTS as any).musicVolume ?? 0.6);
  const annSettings = announcerControls.getSettings();
  const annVol0 = load(K.annVol, Math.min(1, Math.max(0, Number(annSettings.announcerVolume ?? 0.9))));
  const annDuckM0 = load(K.annDuckM, Math.min(1, Math.max(0, Number(annSettings.duckMusic ?? 0.7))));
  const annDuckS0 = load(K.annDuckS, Math.min(1, Math.max(0, Number(annSettings.duckSfx ?? 0.6))));
  const annRel0 = load(K.annRel, Math.min(2, Math.max(0.1, Number((annSettings.duckReleaseMs ?? 600) / 1000))));
  const annGap0 = load(K.annGap, Math.min(8, Math.max(2, Number((annSettings.minGapMs ?? 5000) / 1000))));
  const annOn0 = ((): boolean => { try { return (localStorage.getItem(K.annOn) ?? '1') === '1'; } catch { return true; } })();
  const viz0 = load(K.viz, 1);
  const beat0 = load(K.beat, 1);
  const chip0 = ((): string => {
    try { return localStorage.getItem(K.chip) ?? 'auto'; } catch { return 'auto'; }
  })();
  const elSfx = row('SFX', 'sfxVol', sfx0);
  const elMusic = row('Music', 'musicVol', music0);
  const elViz = row('Visualizer', 'vizSens', viz0, { min: 0, max: 2, step: 0.05 });
  const elBeat = row('Beat Sens', 'beatSens', beat0, { min: 0.5, max: 2, step: 0.05 });
  const elChip = selectRow('Chiptune', 'chipMode', [
    { value: 'auto', label: 'Auto' },
    { value: 'on', label: 'On' },
    { value: 'off', label: 'Off' },
  ], chip0);
  const btns = buttonRow();

  // Announcer controls
  const elAnnToggleWrap = document.createElement('label');
  elAnnToggleWrap.className = 'audio-row';
  elAnnToggleWrap.textContent = 'Announcer ';
  const elAnnToggle = document.createElement('input');
  elAnnToggle.type = 'checkbox'; elAnnToggle.checked = annOn0;
  elAnnToggle.id = 'annEnabled';
  elAnnToggleWrap.appendChild(elAnnToggle);
  pop.appendChild(elAnnToggleWrap);
  const elAnnVol = row('Announcer Vol', 'annVol', annVol0, { min: 0, max: 1, step: 0.05 });
  const elAnnDuckM = row('Duck Music', 'annDuckM', annDuckM0, { min: 0, max: 1, step: 0.05 });
  const elAnnDuckS = row('Duck SFX', 'annDuckS', annDuckS0, { min: 0, max: 1, step: 0.05 });
  const elAnnRel = row('Duck Release (s)', 'annRel', annRel0, { min: 0.1, max: 2, step: 0.05 });
  const elAnnGap = row('VO Min Gap (s)', 'annGap', annGap0, { min: 2, max: 8, step: 0.5 });

  document.body.appendChild(pop);

  // Apply initial volumes
  try { audio.setSfxVolume(sfx0); } catch { /* ignore */ }
  try { audio.setMusicVolume(music0); } catch { /* ignore */ }
  try { audio.setAnnouncerVolume(annVol0); } catch { /* ignore */ }
  try { announcerControls.updateSettings({ duckMusic: annDuckM0, duckSfx: annDuckS0, duckReleaseMs: Math.round(annRel0 * 1000), minGapMs: Math.round(annGap0 * 1000), announcerVolume: annVol0 }); } catch { /* ignore */ }
  try { announcerControls.setEnabled(annOn0); } catch { /* ignore */ }
  // Apply initial visualizer sensitivity
  (sim as any).vizSens = viz0;
  (sim as any).beatSens = beat0;
  (sim as any).chipMode = (chip0 === 'on' || chip0 === 'off') ? chip0 : 'auto';

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
  const onAnnVol = (): void => {
    const v = Math.min(1, Math.max(0, Number(elAnnVol.value)));
    try { audio.setAnnouncerVolume(v); } catch { /* ignore */ }
    announcerControls.updateSettings({ announcerVolume: v });
    save(K.annVol, v);
  };
  elAnnVol.addEventListener('input', onAnnVol);
  const onAnnCommon = (): void => {
    const dM = Math.min(1, Math.max(0, Number(elAnnDuckM.value)));
    const dS = Math.min(1, Math.max(0, Number(elAnnDuckS.value)));
    const rel = Math.round(Math.min(2, Math.max(0.1, Number(elAnnRel.value))) * 1000);
    const gap = Math.round(Math.min(8, Math.max(2, Number(elAnnGap.value))) * 1000);
    announcerControls.updateSettings({ duckMusic: dM, duckSfx: dS, duckReleaseMs: rel, minGapMs: gap });
    save(K.annDuckM, dM); save(K.annDuckS, dS); save(K.annRel, rel / 1000); save(K.annGap, gap / 1000);
  };
  elAnnDuckM.addEventListener('input', onAnnCommon);
  elAnnDuckS.addEventListener('input', onAnnCommon);
  elAnnRel.addEventListener('input', onAnnCommon);
  elAnnGap.addEventListener('input', onAnnCommon);
  elAnnToggle.addEventListener('change', () => {
    const on = !!(elAnnToggle as HTMLInputElement).checked;
    announcerControls.setEnabled(on);
    try { localStorage.setItem(K.annOn, on ? '1' : '0'); } catch { /* ignore */ }
  });
  elViz.addEventListener('input', () => {
    const v = Math.min(2, Math.max(0, Number(elViz.value)));
    (sim as any).vizSens = v;
    save(K.viz, v);
  });
  elBeat.addEventListener('input', () => {
    const v = Math.min(2, Math.max(0.5, Number(elBeat.value)));
    (sim as any).beatSens = v;
    save(K.beat, v);
  });
  elChip.addEventListener('change', () => {
    const v = String(elChip.value);
    (sim as any).chipMode = (v === 'on' || v === 'off') ? v : 'auto';
    save(K.chip, (sim as any).chipMode);
  });
  btns.prev.addEventListener('click', (e) => { e.preventDefault(); try { audio.prevTrack(); } catch { /* ignore */ } });
  btns.next.addEventListener('click', (e) => { e.preventDefault(); try { audio.nextTrack(); } catch { /* ignore */ } });

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
