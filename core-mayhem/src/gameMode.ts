export type GameMode = 'manual' | 'random' | 'tournament';

export function readGameMode(): GameMode {
  try {
    const mode = localStorage.getItem('cm_game_mode');
    if (mode === 'manual' || mode === 'random' || mode === 'tournament') return mode;
  } catch {
    /* use the default when storage is unavailable */
  }
  return 'tournament';
}
