import type { Config } from 'jest';

// Three projects (ADR-0014): `unit` needs nothing but Node; `integration` and `e2e` start a
// PostgreSQL container through Testcontainers, so they need Docker and run in band.
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
