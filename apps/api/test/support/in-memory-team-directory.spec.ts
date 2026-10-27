import { InMemoryTeamDirectory } from './in-memory-team-directory';

const OWNER = 'owner-1';
const STRANGER = 'owner-2';
const MOBILE = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Mobile',
  colorHex: '#7C3AED',
};
const BACKEND = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Backend',
  colorHex: '#0EA5E9',
};
const UNKNOWN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('InMemoryTeamDirectory', () => {
  let directory: InMemoryTeamDirectory;

  beforeEach(() => {
    directory = new InMemoryTeamDirectory();
    directory.add(OWNER, MOBILE);
    directory.add(OWNER, BACKEND);
  });

  it('summarises only the owner’s live teams among the ids', async () => {
    directory.remove(BACKEND.id);

    await expect(
      directory.summaries(OWNER, [MOBILE.id, BACKEND.id, UNKNOWN]),
    ).resolves.toEqual([MOBILE]);
    await expect(directory.summaries(STRANGER, [MOBILE.id])).resolves.toEqual(
      [],
    );
  });

  it('reports deleted, foreign, unknown and malformed ids as missing, in input order', async () => {
    directory.remove(BACKEND.id);

    await expect(
      directory.findMissing(OWNER, [
        'not-a-uuid',
        MOBILE.id,
        UNKNOWN,
        BACKEND.id,
      ]),
    ).resolves.toEqual(['not-a-uuid', UNKNOWN, BACKEND.id]);
    await expect(directory.findMissing(STRANGER, [MOBILE.id])).resolves.toEqual(
      [MOBILE.id],
    );
    await expect(directory.findMissing(OWNER, [])).resolves.toEqual([]);
  });
});
