// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'build', 'coverage', 'node_modules'] },

  // Base JS rules
  js.configs.recommended,

  // TypeScript + stylistic bundles
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true, // lets rules read your tsconfig for type-aware checks
        // If you don’t use a project tsconfig, swap to: tsconfigRootDir: import.meta.dirname
      },
    },
    plugins: {
      import: await import('eslint-plugin-import'),
    },
    settings: {
      // Helps import rules understand TS paths and extensions
      'import/resolver': { typescript: true },
    },
    rules: {
      // Core quality
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',

      // Imports
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-unresolved': 'off', // TS handles this

      // TS specifics
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off', // flip to "warn" if you want to squeeze down `any`
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },

  // Allow plain config/build scripts to be JS/CommonJS if you have any
  {
    files: ['*.config.{js,cjs,mjs}'],
    rules: { '@typescript-eslint/no-var-requires': 'off' },
  },
);
