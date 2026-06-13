import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public', 'scripts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      // mirror the tsconfig: underscore-prefixed = intentionally unused
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // the dev-only window.__sawari bridge and a few three.js casts need these
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // ESLint's formatting rules are turned off so Prettier owns style (no conflicts)
  prettier,
);
