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

const PACKAGES = [
  '@nestjs/common',
  '@prisma/client',
  'class-validator',
  'better-auth',
  '@thallesp/nestjs-better-auth',
];
const DEV_PACKAGES = ['some-dev-tool'];

const roots = [];

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
      compilerOptions: {
        module: 'commonjs',
        baseUrl: '.',
        paths: { '@test/*': ['test/*'] },
      },
    }),
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

async function violationsOf(root) {
  const previous = process.cwd();
  process.chdir(root);
  try {
    const result = await cruise(['src'], {
      ...config.options,
      baseDir: root,
      validate: true,
      ruleSet: { forbidden: config.forbidden },
    });
    return result.output.summary.violations.filter(
      (v) => v.rule.severity === 'error',
    );
  } finally {
    process.chdir(previous);
  }
}

const importOf = (target) => `import '${target}';\n`;

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
        '../../modules/teams/application/team-lookup.service',
      ),
      'src/modules/teams/application/team-lookup.service.ts': 'export {};\n',
    },
    [
      'src/shared/application/a.ts',
      'src/modules/teams/application/team-lookup.service.ts',
    ],
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
    'no-tests-in-production',
    'production file imports from a module tests/ folder',
    {
      'src/modules/teams/application/a.ts': importOf('../tests/unit/helper'),
      'src/modules/teams/tests/unit/helper.ts': 'export {};\n',
    },
    [
      'src/modules/teams/application/a.ts',
      'src/modules/teams/tests/unit/helper.ts',
    ],
  ],
  [
    'no-tests-in-production',
    'production file imports a test helper through the @test alias',
    {
      'src/shared/application/a.ts': importOf('@test/helper'),
      'test/helper.ts': 'export {};\n',
    },
    ['src/shared/application/a.ts', 'test/helper.ts'],
  ],
  [
    'context-wiring',
    'tasks.module imports a teams file at the module root that is not its module',
    {
      'src/modules/tasks/tasks.module.ts': importOf('../teams/teams.helpers'),
      'src/modules/teams/teams.helpers.ts': 'export {};\n',
    },
    ['src/modules/tasks/tasks.module.ts', 'src/modules/teams/teams.helpers.ts'],
  ],
  [
    'context-wiring',
    'AC-09.8 tasks.module imports the teams domain',
    {
      'src/modules/tasks/tasks.module.ts': importOf(
        '../teams/domain/repositories/team.repository',
      ),
      'src/modules/teams/domain/repositories/team.repository.ts':
        'export {};\n',
    },
    [
      'src/modules/tasks/tasks.module.ts',
      'src/modules/teams/domain/repositories/team.repository.ts',
    ],
  ],
  [
    'contexts-isolated',
    'AC-09.8 a tasks use case imports the teams lookup service (the old exception is gone)',
    {
      'src/modules/tasks/application/use-cases/a.use-case.ts': importOf(
        '../../../teams/application/team-lookup.service',
      ),
      'src/modules/teams/application/team-lookup.service.ts': 'export {};\n',
    },
    [
      'src/modules/tasks/application/use-cases/a.use-case.ts',
      'src/modules/teams/application/team-lookup.service.ts',
    ],
  ],
  [
    'contexts-isolated',
    'AC-09.8 tasks presentation imports the teams module file',
    {
      'src/modules/tasks/presentation/a.ts': importOf(
        '../../teams/teams.module',
      ),
      'src/modules/teams/teams.module.ts': 'export {};\n',
    },
    [
      'src/modules/tasks/presentation/a.ts',
      'src/modules/teams/teams.module.ts',
    ],
  ],
  [
    'application-not-to-other-modules',
    'AC-09.8 tasks application imports the teams module file',
    {
      'src/modules/tasks/application/a.ts': importOf(
        '../../teams/teams.module',
      ),
      'src/modules/teams/teams.module.ts': 'export {};\n',
    },
    ['src/modules/tasks/application/a.ts', 'src/modules/teams/teams.module.ts'],
  ],
  [
    'presentation-not-to-domain',
    'AC-09.8 a tasks DTO imports a tasks value object',
    {
      'src/modules/tasks/presentation/dto/a.dto.ts': importOf(
        '../../domain/value-objects/b.vo',
      ),
      'src/modules/tasks/domain/value-objects/b.vo.ts': 'export {};\n',
    },
    [
      'src/modules/tasks/presentation/dto/a.dto.ts',
      'src/modules/tasks/domain/value-objects/b.vo.ts',
    ],
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
      'src/modules/teams/presentation/a.controller.ts': importOf(
        '../domain/repositories/b.repository',
      ),
      'src/modules/teams/domain/repositories/b.repository.ts': 'export {};\n',
    },
    [
      'src/modules/teams/presentation/a.controller.ts',
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
  'src/shared/domain/owner.ts': 'export {};\n',
  'src/modules/tasks/presentation/tasks.controller.ts':
    importOf('../application/use-cases/create-task.use-case') +
    importOf('../../../shared/domain/owner') +
    importOf('@nestjs/common'),
  'src/modules/teams/application/team-lookup.service.ts': 'export {};\n',
  'src/modules/teams/teams.module.ts': importOf(
    './application/team-lookup.service',
  ),
  'src/modules/tasks/application/interfaces/team-directory.interface.ts':
    'export {};\n',
  'src/modules/tasks/tasks.module.ts':
    importOf('./application/use-cases/create-task.use-case') +
    importOf('./application/interfaces/team-directory.interface') +
    importOf('./infrastructure/persistence/task.prisma-repository') +
    importOf('../teams/application/team-lookup.service') +
    importOf('./presentation/tasks.controller') +
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

  it('AC-08.6 AC-09.3 a module file reaching another through its module file and exported provider passes', async () => {
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
