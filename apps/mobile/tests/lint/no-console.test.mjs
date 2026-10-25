import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const eslint = new ESLint({
  cwd: fileURLToPath(new URL('../..', import.meta.url)),
});

async function consoleErrors(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === 'no-console');
}

describe('the token cannot reach log output', () => {
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    it(`rejects console.${method} in app code`, async () => {
      const errors = await consoleErrors(
        `export function f(token: string) {\n  console.${method}(token);\n}\n`,
        'src/features/auth/token.ts',
      );
      assert.equal(errors.length, 1);
      assert.equal(errors[0].severity, 2);
    });
  }

  it('rejects console in routes', async () => {
    const errors = await consoleErrors(
      "console.log('x');\nexport default function R() {\n  return null;\n}\n",
      'app/(tabs)/settings.tsx',
    );
    assert.equal(errors.length, 1);
  });
});
