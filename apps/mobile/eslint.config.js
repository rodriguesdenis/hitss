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
]);
