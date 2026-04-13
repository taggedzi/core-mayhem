import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
  },
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
});
