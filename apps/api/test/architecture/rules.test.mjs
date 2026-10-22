// Meta-tests for apps/api/.dependency-cruiser.cjs (AC-07.7.1, 07.7.2, 07.7.6, 07.7.7, 07.7.9, AC-08.6).
// Each case is a miniature project with the real folder names and one violating import; the
// suite asserts the rule name, the offending file and the import. Written as node:test because
// dependency-cruiser is ESM-only and cannot be loaded by Jest's CommonJS runtime.
import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cruise } from 'dependency-cruiser';

const apiDir = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const config = require(join(apiDir, '.dependency-cruiser.cjs'));

/** Packages the fixtures import; each is created as an empty module in the fixture's node_modules. */
const PACKAGES = [
  '@nestjs/common',
  '@prisma/client',
  'class-validator',
  'better-auth',
  '@thallesp/nestjs-better-auth',
];
const DEV_PACKAGES = ['some-dev-tool'];

const roots = [];

/** Materializes `files` (path -> source) as a project and returns its root. */
function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'arch-'));
  roots.push(root);
  const manifest = {
    name: 'fixture',
    dependencies: Object.fromEntries(PACKAGES.map((name) => [name, '*'])),
    devDependencies: Object.fromEntries(
      DEV_PACKAGES.map((name) => [name, '*']),
    ),
  };
  const all = {
    'package.json': JSON.stringify(manifest),
    'tsconfig.json': JSON.stringify({
      compilerOptions: { module: 'commonjs' },
    }),
    // Type-only package, as installed by the real project (express itself is not a direct dependency).
    'node_modules/@types/express/package.json': JSON.stringify({
      name: '@types/express',
      types: 'index.d.ts',
    }),
    'node_modules/@types/express/index.d.ts': 'export interface Request {}\n',
    ...Object.fromEntries(
      [...PACKAGES, ...DEV_PACKAGES].flatMap((name) => [
        [
          `node_modules/${name}/package.json`,
          JSON.stringify({ name, main: 'index.js' }),
        ],
        [`node_modules/${name}/index.js`, 'module.exports = {};\n'],
      ]),
    ),
    ...files,
  };
  for (const [path, source] of Object.entries(all)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  }
  return root;
}

/** Runs the real rule set over a project; returns the violations of severity "error". */
async function violationsOf(root) {
  const result = await cruise(['src'], {
    ...config.options,
    baseDir: root,
    validate: true,
    ruleSet: { forbidden: config.forbidden },
  });
  return result.output.summary.violations.filter(
    (v) => v.rule.severity === 'error',
  );
}

const importOf = (target) => `import '${target}';\n`;

/** [rule, description, files, expected {from, to}] — every config rule needs at least one row. */
const VIOLATIONS = [
  [
    'domain-no-third-party',
    'domain imports the persistence library',
    { 'src/modules/teams/domain/a.ts': importOf('@prisma/client') },
    ['src/modules/teams/domain/a.ts', 'node_modules/@prisma/client/index.js'],
  ],
  [
    'domain-no-third-party',
    'domain imports the web framework',
    { 'src/modules/teams/domain/a.ts': importOf('@nestjs/common') },
    ['src/modules/teams/domain/a.ts', 'node_modules/@nestjs/common/index.js'],
  ],
  [
    'domain-no-third-party',
    'domain imports the validation library',
    { 'src/shared/domain/a.ts': importOf('class-validator') },
    ['src/shared/domain/a.ts', 'node_modules/class-validator/index.js'],
  ],
  [
    'domain-no-third-party',
    'domain imports a Node core module',
    { 'src/modules/teams/domain/a.ts': importOf('node:fs') },
    ['src/modules/teams/domain/a.ts', 'fs'],
  ],
  [
    'domain-no-generated-client',
    'domain imports the generated persistence client',
    {
      'src/modules/teams/domain/a.ts': importOf(
        '../../../generated/prisma/client',
      ),
      'src/generated/prisma/client.ts': 'export {};\n',
    },
    ['src/modules/teams/domain/a.ts', 'src/generated/prisma/client.ts'],
  ],
  [
    'application-not-to-adapters',
    'application imports the generated persistence client',
    {
      'src/modules/teams/application/a.ts': importOf(
        '../../../generated/prisma/client',
      ),
      'src/generated/prisma/client.ts': 'export {};\n',
    },
    ['src/modules/teams/application/a.ts', 'src/generated/prisma/client.ts'],
  ],
  [
    'presentation-not-to-infra',
    'presentation imports the generated persistence client',
    {
      'src/modules/teams/presentation/a.ts': importOf(
        '../../../generated/prisma/client',
      ),
      'src/generated/prisma/client.ts': 'export {};\n',
    },
    ['src/modules/teams/presentation/a.ts', 'src/generated/prisma/client.ts'],
  ],
  [
    'domain-is-pure',
    'domain imports infrastructure',
    {
      'src/modules/teams/domain/a.ts': importOf('../infrastructure/b'),
      'src/modules/teams/infrastructure/b.ts': 'export {};\n',
    },
    ['src/modules/teams/domain/a.ts', 'src/modules/teams/infrastructure/b.ts'],
  ],
  [
    'domain-is-pure',
    'domain imports application',
    {
      'src/modules/teams/domain/a.ts': importOf('../application/b'),
      'src/modules/teams/application/b.ts': 'export {};\n',
    },
    ['src/modules/teams/domain/a.ts', 'src/modules/teams/application/b.ts'],
  ],
  [
    'domain-is-pure',
    'shared domain imports shared infrastructure',
    {
      'src/shared/domain/a.ts': importOf('../infrastructure/b'),
      'src/shared/infrastructure/b.ts': 'export {};\n',
    },
    ['src/shared/domain/a.ts', 'src/shared/infrastructure/b.ts'],
  ],
  [
    'application-not-to-adapters',
    'application imports infrastructure',
    {
      'src/modules/teams/application/a.ts': importOf('../infrastructure/b'),
      'src/modules/teams/infrastructure/b.ts': 'export {};\n',
    },
    [
      'src/modules/teams/application/a.ts',
      'src/modules/teams/infrastructure/b.ts',
    ],
  ],
  [
    'application-not-to-adapters',
    'application imports presentation',
    {
      'src/modules/teams/application/a.ts': importOf('../presentation/b'),
      'src/modules/teams/presentation/b.ts': 'export {};\n',
    },
    [
      'src/modules/teams/application/a.ts',
      'src/modules/teams/presentation/b.ts',
    ],
  ],
  [
    'application-not-to-adapters',
    'application imports the persistence library',
    { 'src/modules/teams/application/a.ts': importOf('@prisma/client') },
    [
      'src/modules/teams/application/a.ts',
      'node_modules/@prisma/client/index.js',
    ],
  ],
  [
    'application-not-to-adapters',
    'application imports express',
    { 'src/modules/teams/application/a.ts': importOf('express') },
    [
      'src/modules/teams/application/a.ts',
      'node_modules/@types/express/index.d.ts',
    ],
  ],
  [
    'application-not-to-adapters',
    'application imports express types with `import type`',
    {
      'src/modules/teams/application/a.ts':
        "import type { Request } from 'express';\nexport type R = Request;\n",
    },
    [
      'src/modules/teams/application/a.ts',
      'node_modules/@types/express/index.d.ts',
    ],
  ],
  [
    'infrastructure-not-to-presentation',
    'infrastructure imports presentation',
    {
      'src/modules/teams/infrastructure/a.ts': importOf('../presentation/b'),
      'src/modules/teams/presentation/b.ts': 'export {};\n',
    },
    [
      'src/modules/teams/infrastructure/a.ts',
      'src/modules/teams/presentation/b.ts',
    ],
  ],
  [
    'presentation-not-to-infra',
    'presentation imports infrastructure directly',
    {
      'src/modules/teams/presentation/a.ts': importOf('../infrastructure/b'),
      'src/modules/teams/infrastructure/b.ts': 'export {};\n',
    },
    [
      'src/modules/teams/presentation/a.ts',
      'src/modules/teams/infrastructure/b.ts',
    ],
  ],
  [
    'presentation-not-to-infra',
    'presentation imports the persistence library',
    { 'src/modules/teams/presentation/a.ts': importOf('@prisma/client') },
    [
      'src/modules/teams/presentation/a.ts',
      'node_modules/@prisma/client/index.js',
    ],
  ],
  [
    'shared-not-to-features',
    'shared imports a context',
    {
      'src/shared/application/a.ts': importOf(
        '../../modules/teams/team-lookup.service',
      ),
      'src/modules/teams/team-lookup.service.ts': 'export {};\n',
    },
    ['src/shared/application/a.ts', 'src/modules/teams/team-lookup.service.ts'],
  ],
  [
    'shared-not-to-features',
    'config imports a context',
    {
      'src/config/a.ts': importOf('../modules/teams/teams.module'),
      'src/modules/teams/teams.module.ts': 'export {};\n',
    },
    ['src/config/a.ts', 'src/modules/teams/teams.module.ts'],
  ],
  [
    'no-circular',
    'two modules import each other',
    {
      'src/modules/teams/teams.module.ts': importOf('../tasks/tasks.module'),
      'src/modules/tasks/tasks.module.ts': importOf('../teams/teams.module'),
    },
    ['src/modules/tasks/tasks.module.ts', 'src/modules/teams/teams.module.ts'],
  ],
  [
    'no-tests-in-production',
    'production file imports a spec file',
    {
      'src/shared/application/a.ts': importOf('./a.spec'),
      'src/shared/application/a.spec.ts': 'export {};\n',
    },
    ['src/shared/application/a.ts', 'src/shared/application/a.spec.ts'],
  ],
  [
    'no-tests-in-production',
    'production file imports a testing helper',
    {
      'src/modules/teams/application/a.ts': importOf(
        '../../../config/testing/helper',
      ),
      'src/config/testing/helper.ts': 'export {};\n',
    },
    ['src/modules/teams/application/a.ts', 'src/config/testing/helper.ts'],
  ],
  [
    'no-tests-in-production',
    'production file imports from the test/ folder',
    {
      'src/shared/application/a.ts': importOf('../../../test/helper'),
      'test/helper.ts': 'export {};\n',
    },
    ['src/shared/application/a.ts', 'test/helper.ts'],
  ],
  [
    'contexts-isolated',
    'tasks imports a teams file at the module root that is neither its lookup service nor its module',
    {
      'src/modules/tasks/tasks.module.ts': importOf('../teams/teams.helpers'),
      'src/modules/teams/teams.helpers.ts': 'export {};\n',
    },
    ['src/modules/tasks/tasks.module.ts', 'src/modules/teams/teams.helpers.ts'],
  ],
  [
    'not-to-dev-dep',
    'production file imports a dev dependency',
    { 'src/shared/application/a.ts': importOf('some-dev-tool') },
    ['src/shared/application/a.ts', 'node_modules/some-dev-tool/index.js'],
  ],
  [
    'not-to-unresolvable',
    'production file imports a missing file',
    { 'src/shared/application/a.ts': importOf('./missing') },
    ['src/shared/application/a.ts', './missing'],
  ],
  [
    'auth-library-in-identity',
    'a context controller imports the auth library guard decorators',
    {
      'src/modules/teams/presentation/a.ts': importOf(
        '@thallesp/nestjs-better-auth',
      ),
    },
    [
      'src/modules/teams/presentation/a.ts',
      'node_modules/@thallesp/nestjs-better-auth/index.js',
    ],
  ],
  [
    'auth-library-in-identity',
    'shared code imports Better Auth types',
    { 'src/shared/presentation/a.ts': importOf('better-auth') },
    ['src/shared/presentation/a.ts', 'node_modules/better-auth/index.js'],
  ],
  [
    'auth-library-in-identity',
    'a context spec imports Better Auth',
    { 'src/modules/tasks/application/a.spec.ts': importOf('better-auth') },
    [
      'src/modules/tasks/application/a.spec.ts',
      'node_modules/better-auth/index.js',
    ],
  ],
];

VIOLATIONS.push(
  [
    'persistence-not-to-use-cases',
    'a persistence adapter calls a use case',
    {
      'src/modules/teams/infrastructure/persistence/a.ts': importOf(
        '../../application/use-cases/b.use-case',
      ),
      'src/modules/teams/application/use-cases/b.use-case.ts': 'export {};\n',
    },
    [
      'src/modules/teams/infrastructure/persistence/a.ts',
      'src/modules/teams/application/use-cases/b.use-case.ts',
    ],
  ],
  [
    'presentation-not-to-repositories',
    'a controller uses a repository instead of a use case',
    {
      'src/modules/teams/presentation/http/a.controller.ts': importOf(
        '../../domain/repositories/b.repository',
      ),
      'src/modules/teams/domain/repositories/b.repository.ts': 'export {};\n',
    },
    [
      'src/modules/teams/presentation/http/a.controller.ts',
      'src/modules/teams/domain/repositories/b.repository.ts',
    ],
  ],
  [
    'contexts-isolated',
    'AC-08.6 tasks imports a teams contracts/ file (no longer a public seam)',
    {
      'src/modules/tasks/application/a.ts': importOf('../../teams/contracts/b'),
      'src/modules/teams/contracts/b.ts': 'export {};\n',
    },
    ['src/modules/tasks/application/a.ts', 'src/modules/teams/contracts/b.ts'],
  ],
);

/** A5: one violating import per source layer into the same layer of another context. */
const LAYERS = ['domain', 'application', 'infrastructure', 'presentation'];
for (const layer of LAYERS) {
  VIOLATIONS.push([
    'contexts-isolated',
    `${layer} of tasks imports ${layer} of teams`,
    {
      [`src/modules/tasks/${layer}/a.ts`]: importOf(`../../teams/${layer}/b`),
      [`src/modules/teams/${layer}/b.ts`]: 'export {};\n',
    },
    [`src/modules/tasks/${layer}/a.ts`, `src/modules/teams/${layer}/b.ts`],
  ]);
}

/** Compliant code in the ADR-0020 layout, including every allowed edge. */
const COMPLIANT = {
  'src/shared/domain/clock.ts': 'export {};\n',
  'src/modules/tasks/domain/entities/task.entity.ts': importOf(
    '../../../../shared/domain/clock',
  ),
  'src/modules/tasks/domain/repositories/task.repository.ts': importOf(
    '../entities/task.entity',
  ),
  'src/modules/tasks/application/use-cases/create-task.use-case.ts':
    importOf('../../domain/repositories/task.repository') +
    importOf('../../../../shared/domain/clock') +
    importOf('@nestjs/common'),
  'src/modules/tasks/infrastructure/persistence/task.prisma-repository.ts':
    importOf('../../domain/repositories/task.repository') +
    importOf('@prisma/client'),
  'src/modules/tasks/presentation/http/tasks.controller.ts':
    importOf('../../application/use-cases/create-task.use-case') +
    importOf('@nestjs/common'),
  // ADR-0020: another module is reached only through its lookup service and its module.
  'src/modules/teams/team-lookup.service.ts': 'export {};\n',
  'src/modules/teams/teams.module.ts': importOf('./team-lookup.service'),
  'src/modules/tasks/infrastructure/persistence/team-directory.ts': importOf(
    '../../../teams/team-lookup.service',
  ),
  'src/modules/tasks/tasks.module.ts':
    importOf('./application/use-cases/create-task.use-case') +
    importOf('./infrastructure/persistence/task.prisma-repository') +
    importOf('./infrastructure/persistence/team-directory') +
    importOf('./presentation/http/tasks.controller') +
    importOf('../teams/teams.module'),
  'src/modules/tasks/application/use-cases/create-task.use-case.spec.ts':
    importOf('./create-task.use-case'),
  'src/modules/identity/auth.factory.ts': importOf('better-auth'),
  'src/modules/identity/identity.module.ts':
    importOf('./auth.factory') + importOf('@thallesp/nestjs-better-auth'),
  'src/main.ts':
    importOf('./modules/tasks/tasks.module') +
    importOf('./modules/identity/identity.module'),
};

describe('architecture rules', () => {
  after(() =>
    roots.forEach((root) => rmSync(root, { recursive: true, force: true })),
  );

  for (const [rule, description, files, [from, to]] of VIOLATIONS) {
    it(`AC-07.7.1 ${rule}: ${description}`, async () => {
      const violations = await violationsOf(project(files));
      const hit = violations.find(
        (v) => v.rule.name === rule && v.from === from && v.to === to,
      );
      assert.ok(
        hit,
        `expected ${rule} for ${from} -> ${to}, got:\n${violations.map((v) => `${v.rule.name} ${v.from} -> ${v.to}`).join('\n') || '(none)'}`,
      );
    });
  }

  it('AC-08.6 a module reaching another through its lookup service and module file passes', async () => {
    const violations = await violationsOf(project(COMPLIANT));
    assert.deepEqual(
      violations.map((v) => `${v.rule.name} ${v.from} -> ${v.to}`),
      [],
    );
  });

  it('AC-07.7.2 code that follows every rule passes', async () => {
    assert.deepEqual(await violationsOf(project(COMPLIANT)), []);
  });

  it('AC-07.7.9 rule names are unique, so coverage per name is coverage per rule', () => {
    const names = config.forbidden.map((rule) => rule.name);
    assert.deepEqual(names, [...new Set(names)]);
  });

  it('AC-07.7.9 every configured rule (except no-orphans) has a violating fixture', () => {
    const covered = new Set(VIOLATIONS.map(([rule]) => rule));
    const missing = [...new Set(config.forbidden.map((r) => r.name))].filter(
      (name) => name !== 'no-orphans' && !covered.has(name),
    );
    assert.deepEqual(
      missing,
      [],
      `rules without a fixture: ${missing.join(', ')}`,
    );
  });

  it('AC-07.7.2 the real src/ tree has no violations (same check as pnpm arch)', async () => {
    const result = await cruise(['src'], {
      ...config.options,
      baseDir: apiDir,
      validate: true,
      ruleSet: { forbidden: config.forbidden },
      tsConfig: { fileName: join(apiDir, 'tsconfig.json') },
    });
    const errors = result.output.summary.violations.filter(
      (v) => v.rule.severity === 'error',
    );
    assert.deepEqual(
      errors.map((v) => `${v.rule.name} ${v.from} -> ${v.to}`),
      [],
    );
  });
});
