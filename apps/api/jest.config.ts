import type { Config } from 'jest';

// Three projects (ADR-0014). `pnpm test` runs `unit` only: plain Node, no Docker.
// `integration` and `e2e` need Docker: globalSetup starts one PostgreSQL container per run and
// migrates a template database; each test file clones it (test/support/postgres.ts).
const base = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  transform: {
    // CommonJS output turns `await import()` (used by the Prisma client to load its query
    // compiler) into `require()`; Jest's VM cannot run native dynamic imports without a flag.
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: {
          // Transpile file by file, no type check: fast runs. `pnpm typecheck` owns types.
          isolatedModules: true,
          module: 'commonjs',
          moduleResolution: 'node10',
          resolvePackageJsonExports: false,
        },
      },
    ],
  },
  // The generated Prisma client imports its siblings as `./x.js` (Node ESM-style specifiers).
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  setupFiles: ['<rootDir>/test/setup-env.ts'],
} satisfies Config;

const withDatabase = {
  ...base,
  roots: ['<rootDir>/test'],
  globalSetup: '<rootDir>/test/support/global-setup.ts',
  globalTeardown: '<rootDir>/test/support/global-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/test/support/after-env.ts'],
  testTimeout: 120_000,
} satisfies Config;

const config: Config = {
  coverageDirectory: '<rootDir>/coverage',
  projects: [
    {
      ...base,
      displayName: 'unit',
      roots: ['<rootDir>/src'],
      testRegex: '.*\\.spec\\.ts$',
      collectCoverageFrom: ['src/**/*.(t|j)s', '!src/generated/**'],
    },
    {
      ...withDatabase,
      displayName: 'integration',
      testRegex: '.*\\.int-spec\\.ts$',
    },
    { ...withDatabase, displayName: 'e2e', testRegex: '.*\\.e2e-spec\\.ts$' },
  ],
};

export default config;
