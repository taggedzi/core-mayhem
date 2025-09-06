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
        // heavy rendering module covered by integration/e2e
        'src/render/drawModel.ts',
        'src/render/renderScene.ts',
        'src/sim/index.ts',
        'src/vite-env.d.ts',
        // UI-only modules not exercised by unit tests
        'src/ui/**',
        // Dev hotkeys are integration/UI oriented
        'src/app/devKeys.ts',
        // Physics helpers that require integration contexts
        'src/sim/gel.ts',
        'src/sim/world.ts',
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
