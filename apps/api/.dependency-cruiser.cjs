// Architecture rules A1-A9 of docs/architecture/overview.md §7 (enforced in CI by `pnpm arch`).
// Paths are the overview §6.2 paths: renaming a folder is an architecture change, amend the
// overview first. The rule `name` is what the check prints and what the meta-tests assert
// (test/architecture/rules.test.mjs); every rule needs a violating fixture there.

/** Layer rules apply to production files only; specs may import their subject and fakes. */
const NON_SPEC = { pathNot: '\\.spec\\.ts$' };
/** Generated Prisma client (gitignored): a persistence library like any other. */
const GENERATED = '^src/generated/';
/** A bounded context or the shared kernel. */
const LAYER = '^src/(modules/[^/]+|shared)';
const NPM = [
  'npm',
  'npm-dev',
  'npm-peer',
  'npm-optional',
  'npm-bundled',
  'npm-no-pkg',
  'npm-unknown',
];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'A1: the domain does not depend on outer layers.',
      severity: 'error',
      from: { path: `${LAYER}/domain/`, ...NON_SPEC },
      to: { path: `${LAYER}/(application|infrastructure|presentation)/` },
    },
    {
      name: 'domain-no-third-party',
      comment:
        'A1: the domain is plain TypeScript. Allowlist is empty; adding a pure library needs an ADR.',
      severity: 'error',
      from: { path: `${LAYER}/domain/`, ...NON_SPEC },
      to: { dependencyTypes: [...NPM, 'core'], pathNot: [] },
    },
    {
      name: 'domain-no-generated-client',
      comment: 'A1 (generated persistence client).',
      severity: 'error',
      from: { path: `${LAYER}/domain/`, ...NON_SPEC },
      to: { path: GENERATED },
    },
    {
      name: 'application-not-to-adapters',
      comment: 'A2: use cases know ports, not adapters.',
      severity: 'error',
      from: { path: `${LAYER}/application/`, ...NON_SPEC },
      to: {
        path: `${LAYER}/(infrastructure|presentation)/|node_modules/(@prisma|express|@types/express(-serve-static-core)?)/|${GENERATED}`,
      },
    },
    {
      name: 'infrastructure-not-to-presentation',
      comment: 'A3: infrastructure does not reach up.',
      severity: 'error',
      from: { path: `${LAYER}/infrastructure/`, ...NON_SPEC },
      to: { path: `${LAYER}/presentation/` },
    },
    {
      name: 'presentation-not-to-infra',
      comment: 'A4: controllers use buses and use cases, never adapters.',
      severity: 'error',
      from: { path: `${LAYER}/presentation/`, ...NON_SPEC },
      to: {
        path: `${LAYER}/infrastructure/|node_modules/@prisma/|${GENERATED}`,
      },
    },
    {
      name: 'contexts-isolated',
      comment:
        'A5: any layer of a bounded context may reach another context only through its contracts/ folder.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/', ...NON_SPEC },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/contracts/'],
      },
    },
    {
      name: 'contracts-are-thin',
      comment:
        'A6: contracts import only other contracts, their own domain events and the shared domain.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/contracts/', ...NON_SPEC },
      to: {
        path: '^src/',
        pathNot: [
          '^src/modules/[^/]+/contracts/',
          '^src/modules/$1/domain/[^/]+\\.events\\.ts$',
          '^src/shared/domain/',
        ],
      },
    },
    {
      name: 'contracts-no-libraries',
      comment: 'A6 (libraries): only the CQRS marker types are allowed.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/contracts/', ...NON_SPEC },
      to: {
        dependencyTypes: [...NPM, 'core'],
        pathNot: 'node_modules/@nestjs/cqrs/',
      },
    },
    {
      name: 'shared-not-to-features',
      comment: 'A7: shared code and configuration never depend on a context.',
      severity: 'error',
      from: { path: '^src/(shared|config)/', ...NON_SPEC },
      to: { path: '^src/modules/' },
    },
    {
      name: 'auth-library-in-identity',
      comment:
        'A5 (anti-corruption, plan 001 → CurrentOwner): only Identity uses the auth library; other code sees Owner, @Public() and @CurrentOwner(). Specs included.',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/modules/identity/' },
      to: {
        // pnpm resolves to node_modules/.pnpm/<pkg>@<v>/node_modules/<pkg>/: the tail matches both.
        path: 'node_modules/(better-auth|@better-auth/[^/]+|@thallesp/nestjs-better-auth)/',
      },
    },
    {
      name: 'no-circular',
      comment: 'A8: no import cycles.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-tests-in-production',
      comment: 'A9: production code never imports specs or test folders.',
      severity: 'error',
      from: { path: '^src/', pathNot: ['\\.spec\\.ts$', '(^|/)testing/'] },
      to: { path: '\\.spec\\.ts$|^test/|(^|/)testing/' },
    },
    {
      name: 'not-to-dev-dep',
      severity: 'error',
      from: { path: '^src/', ...NON_SPEC },
      to: { dependencyTypes: ['npm-dev'] },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-orphans',
      comment: 'Reported, never fails.',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: '\\.(spec|d)\\.ts$|(^|/)main\\.ts$|(^|/)instrumentation\\.ts$',
      },
      to: {},
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    // `import type` counts: type-only imports also break the architecture.
    tsPreCompilationDeps: true,
    // Generated code is a dependency target, never part of the checked graph.
    doNotFollow: { path: `node_modules|${GENERATED}` },
    // ESM-only packages (better-auth, @thallesp/nestjs-better-auth) publish their subpaths under
    // the `import` export condition only; resolve both conditions, as Node 24 does at runtime.
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
