import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    outDir: 'dist',
  },
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins:
    mode === 'portable'
      ? [
          {
            name: 'music-free-distribution',
            closeBundle() {
              const music = fileURLToPath(new URL('./dist/assets/music/', import.meta.url));
              rmSync(music, { recursive: true, force: true });
              mkdirSync(music, { recursive: true });
              writeFileSync(new URL('./dist/assets/music/playlist.json', import.meta.url), '[]\n');
            },
          },
        ]
      : [],
}));
