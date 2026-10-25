module.exports = {
  forbidden: [
    {
      name: 'no-css-in-js',
      severity: 'error',
      comment: 'Styling is NativeWind only (AC-04.15.1).',
      from: {},
      to: { path: '(^|/)node_modules/(styled-components|@emotion/)' },
    },
    {
      name: 'shared-never-imports-features-or-app',
      severity: 'error',
      from: { path: '^src/(ui|theme|lib)/' },
      to: { path: '^(src/features|app)/' },
    },
    {
      name: 'features-never-import-app',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^app/' },
    },
    {
      name: 'features-cross-only-through-index',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/([^/]+)/.+',
        pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'storage-only-in-adapter',
      severity: 'error',
      from: { pathNot: ['^src/lib/storage\\.ts$', '^src/features/auth/'] },
      to: {
        path: '(^|/)node_modules/(@react-native-async-storage/async-storage|expo-secure-store)/',
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)tests?/|\\.test\\.tsx?$' },
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'react-native', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.json'],
    },
  },
};
