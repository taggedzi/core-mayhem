import { audio } from '../audio';
import { AUDIO_DEFAULTS } from '../audio/config';

const K = {
  sfx: 'cm_sfxVolume',
  music: 'cm_musicVolume',
};

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
  const elSfx = document.getElementById('sfxVol') as HTMLInputElement | null;
  const elMusic = document.getElementById('musicVol') as HTMLInputElement | null;
  if (!elSfx || !elMusic) return;

  const sfx0 = load(K.sfx, (AUDIO_DEFAULTS as any).sfxVolume ?? 1);
  const music0 = load(K.music, (AUDIO_DEFAULTS as any).musicVolume ?? 0.6);

  elSfx.value = String(sfx0);
  elMusic.value = String(music0);

  // Apply initial
  try { audio.setSfxVolume(sfx0); } catch { /* ignore */ }
  try { audio.setMusicVolume(music0); } catch { /* ignore */ }

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
}

