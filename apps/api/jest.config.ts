import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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

// CI writes a JUnit report per run (named after the selected project); the integration job
// uploads the reports when it fails. Reporters are global in Jest, not per project.
const selectedAt = process.argv.findIndex(
  (arg) => arg === '--selectProjects' || arg.startsWith('--selectProjects='),
);
const selectedArg = selectedAt >= 0 ? process.argv[selectedAt] : undefined;
const selected =
  selectedArg === undefined
    ? 'all'
    : selectedArg.includes('=')
      ? selectedArg.slice(selectedArg.indexOf('=') + 1)
      : (process.argv[selectedAt + 1] ?? 'all');
const reporters: Config['reporters'] = process.env.CI
  ? [
      'default',
      [
        'jest-junit',
        {
          outputDirectory: '<rootDir>/reports',
          outputName: `junit-${selected}.xml`,
        },
      ],
    ]
  : ['default'];

// Every domain layer (each context's `domain/` plus the shared kernel's) must stay at 90 % lines.
// Directory keys are aggregated by Jest; globs would be checked file by file. New contexts are
// picked up automatically.
// Jest loads this file as an ES module, where __dirname does not exist; tsc (CommonJS output)
// does not know that, hence the expected error. Resolving from the file keeps the run independent
// of the working directory.
// @ts-expect-error TS1470: import.meta is valid here, Jest evaluates this file as ESM
const modulesDir = join(import.meta.dirname, 'src/modules');
const domainLayers = [
  './src/shared/domain/',
  ...readdirSync(modulesDir)
    .filter((name) => existsSync(join(modulesDir, name, 'domain')))
    .map((name) => `./src/modules/${name}/domain/`),
];
const domainThresholds = Object.fromEntries(
  domainLayers.map((dir) => [dir, { lines: 90 }]),
);

const config: Config = {
  coverageDirectory: '<rootDir>/coverage',
  // The gate measures what unit tests can prove: domain, application and shared code.
  // Infrastructure and presentation are proven by the integration and e2e projects.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/infrastructure/**',
    '!src/**/presentation/**',
    '!src/generated/**',
    '!src/main.ts',
    '!src/instrumentation.ts',
  ],
  reporters,
  // Gates of AC-07.6.5, enforced when jest runs with --coverage (CI unit job): overall line
  // coverage 80 %, the domain layers 90 %. Jest prints the shortfall when one is missed.
  coverageThreshold: {
    global: { lines: 80 },
    ...domainThresholds,
  },
  projects: [
    {
      ...base,
      displayName: 'unit',
      // test/support holds shared fakes; their contract specs run with the unit tests.
      roots: ['<rootDir>/src', '<rootDir>/test/support'],
      testRegex: '.*\\.spec\\.ts$',
    },
    {
      ...withDatabase,
      displayName: 'integration',
      testRegex: '.*\\.int-spec\\.ts$',
    },
    {
      ...withDatabase,
      displayName: 'e2e',
      testRegex: '.*\\.e2e-spec\\.ts$',
    },
    {
      // Never selected by a script: test/support/in-time-zone.ts runs these files in a child
      // process started with TZ set, because a test cannot change the zone of its own process
      // (Jest's sandboxed process.env does not reach the real one).
      ...base,
      displayName: 'tz-probe',
      roots: ['<rootDir>/test/probes'],
      testRegex: '.*\\.tz-probe\\.ts$',
    },
  ],
};

export default config;
