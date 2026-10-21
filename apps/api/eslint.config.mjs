// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Configuration is read only through the validated config module (src/config).
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Read configuration through AppConfig (APP_CONFIG), not process.env.',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error', // constitution V.3: no `any`
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // Allowed readers of process.env: the config module, instrumentation and tests.
    files: [
      'src/config/**/*.ts',
      'src/instrumentation.ts',
      'test/**/*.ts',
      '**/*.spec.ts',
      '**/*.e2e-spec.ts',
    ],
    rules: { 'no-restricted-properties': 'off' },
  },
);
