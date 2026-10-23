import { audio } from '../audio';

let discovery: Promise<string[]> | null = null;
let owner = 0;

async function discoverPlaylist(): Promise<string[]> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}assets/music/playlist.json`, {
      cache: 'no-cache',
    });
    if (response.ok) {
      const files: unknown = await response.json();
      const urls = Array.isArray(files)
        ? files
            .filter(
              (file): file is string => typeof file === 'string' && /\.(mp3|ogg)$/i.test(file),
            )
            .map((file) => `${import.meta.env.BASE_URL}assets/music/${file}`)
        : [];
      if (urls.length) return urls;
    }
  } catch {
    // A missing playlist can still use the default track.
  }
  try {
    const url = `${import.meta.env.BASE_URL}assets/music/main_theme.mp3`;
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok ? [url] : [];
  } catch {
    return [];
  }
}

/** Share discovery, but only let the latest live match change playback. */
export function startMusicForMatch(): () => void {
  const generation = ++owner;
  let active = true;
  void (async () => {
    const urls = audio.hasPlaylist()
      ? []
      : await (discovery ??= discoverPlaylist().finally(() => {
          discovery = null;
        }));
    if (!active || generation !== owner) return;
    if (!audio.hasPlaylist() && urls.length) audio.setMusicPlaylist(urls);
    // Music can continue through an automatic match transition.
    if (audio.hasPlaylist() && !audio.isMusicPlaying()) audio.playMusic();
  })().catch(() => void 0);
  return () => {
    active = false;
  };
}
