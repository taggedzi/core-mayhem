import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    restoreMocks: true,
    clearMocks: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: { reporter: ['text', 'html'], reportsDirectory: './coverage' },
  },
});
