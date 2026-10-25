const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/**',
      '.expo/**',
      'expo-env.d.ts',
      '../../packages/api-client/src/generated/**',
    ],
  },
  {
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'HTTP goes through @hitss/api-client (packages/api-client/src/mutator.ts) or the Better Auth client.',
        },
      ],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/features/*/components/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@hitss/api-client', '@hitss/api-client/*'],
              allowImportNamePattern: '^use[A-Z]',
              allowTypeImports: true,
              message:
                'Screens and routes use the generated use* hooks; request functions and the mutator stay in feature hooks and src/lib.',
            },
          ],
        },
      ],
    },
  },
]);
