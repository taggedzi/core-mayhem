import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    restoreMocks: true,
    clearMocks: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      enabled: true,
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      all: true,
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.d.ts',
        'node_modules/**',
        'eslint.config.*',
        'vitest.config.ts',
        // Entry points / barrels that are hard to cover in unit tests
        'src/main.ts',
        'src/barrel.ts',
        'src/app/index.ts',
        'src/render/index.ts',
        'src/sim/index.ts',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 55,
        functions: 65,
        lines: 70,
      },
    },
  },
});
