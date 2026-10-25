import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const eslint = new ESLint({
  cwd: fileURLToPath(new URL('../..', import.meta.url)),
});

async function restrictedImportErrors(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter(
    (m) => m.ruleId === '@typescript-eslint/no-restricted-imports',
  );
}

const rawRequest =
  "import { teamsList } from '@hitss/api-client';\nexport const x = teamsList;\n";
const clientConfig =
  "import { configureApiClient } from '@hitss/api-client';\nexport const x = configureApiClient;\n";
const hookAndType =
  "import { useTeamsList, type TeamResponseDto } from '@hitss/api-client';\nexport const x: [typeof useTeamsList, TeamResponseDto?] = [useTeamsList];\n";

const files = [
  'app/(tabs)/teams.tsx',
  'src/features/teams/components/TeamsListScreen.tsx',
];

describe('AC-04.15.3 api-client imports in screens and routes', () => {
  for (const file of files) {
    it(`rejects a raw request function in ${file}`, async () => {
      assert.equal((await restrictedImportErrors(rawRequest, file)).length, 1);
    });

    it(`rejects the client configuration in ${file}`, async () => {
      assert.equal(
        (await restrictedImportErrors(clientConfig, file)).length,
        1,
      );
    });

    it(`allows generated hooks and types in ${file}`, async () => {
      assert.deepEqual(await restrictedImportErrors(hookAndType, file), []);
    });
  }

  it('leaves feature hooks free to compose request functions', async () => {
    assert.deepEqual(
      await restrictedImportErrors(
        rawRequest,
        'src/features/teams/hooks/useTeamsList.ts',
      ),
      [],
    );
  });
});
