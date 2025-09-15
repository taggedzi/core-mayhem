import { defineConfig } from 'vite';

// Vite config
// - base: './' makes built asset URLs relative so the site can be hosted
//   at domain root or any subpath without additional config.
// - build.outDir: ensure outputs go to `core-mayhem/dist`.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});

