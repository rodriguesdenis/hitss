import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from '../support/app';
import { bearerOf, signUpAndSignIn, TestUser, twoUsers } from '../support/auth';
import { useTestDatabase } from '../support/postgres';

const TEAMS = '/api/v1/teams';
const UNKNOWN_ID = '0b7a3c1e-2d4f-4a6b-8c9d-1e2f3a4b5c6d';

interface TeamBody {
  id: string;
  name: string;
  colorHex: string;
  description: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

describe('PUT /api/v1/teams/:id (e2e)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let sql: Client;

  beforeAll(async () => {
    app = await createTestApp(db.url, {
      config: { authRateLimitEnabled: false },
    });
    sql = new Client({ connectionString: db.url });
    await sql.connect();
  });

  afterAll(async () => {
    await sql.end();
    await app.close();
  });

  const http = () => request(app.getHttpServer() as App);

  const createTeam = async (
    user: TestUser,
    name = 'Mobile',
    description: string | null = 'Apps',
  ): Promise<TeamBody> => {
    const response = await http()
      .post(TEAMS)
      .set('Authorization', bearerOf(user))
      .send({ name, colorHex: '#7C3AED', description });
    expect(response.status).toBe(201);
    return (response.body as { data: TeamBody }).data;
  };

  const put = (user: TestUser, id: string, body: unknown, ifMatch?: string) => {
    const call = http()
      .put(`${TEAMS}/${id}`)
      .set('Authorization', bearerOf(user))
      .send(body as object);
    return ifMatch === undefined ? call : call.set('If-Match', ifMatch);
  };

  /** The stored row, straight from the database. */
  const row = async (id: string) =>
    (
      await sql.query<{
        name: string;
        color_hex: string;
        description: string | null;
        version: number;
        updated_at: Date;
      }>(
        'SELECT name, color_hex, description, version, updated_at FROM teams WHERE id = $1',
        [id],
      )
    ).rows[0];

  const expectError = (response: Response, status: number, code: string) => {
    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({ error: { code } });
  };

  const expectInvalid = (response: Response, field: string) => {
    expectError(response, 400, 'VALIDATION_FAILED');
    const details = (
      response.body as { error: { details: { field: string }[] } }
    ).error.details;
    expect(details.map((detail) => detail.field)).toContain(field);
  };

  describe('replacement', () => {
    it('AC-02.6.1 AC-02.9.1 replaces every field: version 1 → 2, no ETag, updatedAt advances, createdAt kept', async () => {
      const user = await signUpAndSignIn(app);
      const team = await createTeam(user);

      const response = await put(
        user,
        team.id,
        { name: ' Platform ', colorHex: '#0ea5e9', description: 'Infra' },
        'W/"1"',
      );

      expect(response.status).toBe(200);
      const after = (response.body as { data: TeamBody }).data;
      expect(after).toMatchObject({
        id: team.id,
        name: 'Platform',
        colorHex: '#0EA5E9',
        description: 'Infra',
        version: 2,
        createdAt: team.createdAt,
      });
      expect(Date.parse(after.updatedAt)).toBeGreaterThan(
        Date.parse(team.updatedAt),
      );
      expect(response.headers.etag).toBeUndefined(); // AC-08.3
    });

    it('AC-02.6.3 omitting the description clears it (full replacement)', async () => {
      const user = await signUpAndSignIn(app);
      const team = await createTeam(user);

      const response = await put(user, team.id, {
        name: 'Mobile',
        colorHex: '#7C3AED',
      });

      expect((response.body as { data: TeamBody }).data.description).toBeNull();
      expect((await row(team.id))?.description).toBeNull();
    });

    it('AC-02.6.5 a letter-case-only rename succeeds', async () => {
      const user = await signUpAndSignIn(app);
      const team = await createTeam(user, 'mobile');

      const response = await put(user, team.id, {
        name: 'Mobile',
        colorHex: '#7C3AED',
      });

      expect(response.status).toBe(200);
      expect((response.body as { data: TeamBody }).data.name).toBe('Mobile');
    });

    it('AC-02.6.7 the current values (after trimming and normalization) are a no-op: version and updatedAt unchanged', async () => {
      const user = await signUpAndSignIn(app);
      const team = await createTeam(user);
      const before = await row(team.id);

      const response = await put(user, team.id, {
        name: '  Mobile ',
        colorHex: '#7c3aed',
        description: ' Apps ',
      });

      expect(response.status).toBe(200);
      expect((response.body as { data: TeamBody }).data).toMatchObject({
        version: 1,
        updatedAt: team.updatedAt,
      });
      expect(response.headers.etag).toBeUndefined(); // AC-08.3
      expect(await row(team.id)).toEqual(before);
    });

    it('AC-02.6.4 renaming to another active team name → 409, the team unchanged', async () => {
      const user = await signUpAndSignIn(app);
      await createTeam(user, 'Mobile');
      const backend = await createTeam(user, 'Backend');

      expectError(
        await put(user, backend.id, { name: 'mobile', colorHex: '#7C3AED' }),
        409,
        'TEAM_NAME_ALREADY_EXISTS',
      );
      expect(await row(backend.id)).toMatchObject({
        name: 'Backend',
        version: 1,
      });
    });
  });

  describe('validation first, and the same rules as creation (AC-02.6.2)', () => {
    it.each([
      ['a 1-character name', { name: 'M' }, 'name'],
      ['a name with a control character', { name: 'Mo\u0000bile' }, 'name'],
      ['a bad color', { colorHex: '#FFF' }, 'colorHex'],
      [
        'a 281-character description',
        { description: 'd'.repeat(281) },
        'description',
      ],
      ['a description with a tab', { description: 'a\tb' }, 'description'],
    ])(
      'AC-02.6.2 %s → 400 naming the field, team unchanged',
      async (_label, override, field) => {
        const user = await signUpAndSignIn(app);
        const team = await createTeam(user);
        const before = await row(team.id);

        const response = await put(user, team.id, {
          name: 'Platform',
          colorHex: '#0EA5E9',
          ...override,
        });

        expectInvalid(response, field);
        expect(await row(team.id)).toEqual(before);
      },
    );

    it.each([
      ['id', UNKNOWN_ID],
      ['ownerId', 'someone-else'],
      ['owner_id', 'someone-else'],
      ['userId', 'someone-else'],
      ['owner', { id: 'someone-else' }],
      ['version', 7],
      ['taskCount', 9],
      ['updatedAt', '2020-01-01T00:00:00.000Z'],
      ['deletedAt', '2020-01-01T00:00:00.000Z'],
    ])(
      'AC-02.6.2 AC-01.6.6 an extra %s → 400 naming it, team unchanged',
      async (field, value) => {
        const user = await signUpAndSignIn(app);
        const team = await createTeam(user);
        const before = await row(team.id);

        expectInvalid(
          await put(user, team.id, {
            name: 'Platform',
            colorHex: '#0EA5E9',
            [field]: value,
          }),
          field,
        );
        expect(await row(team.id)).toEqual(before);
      },
    );

    it.each(['__proto__', 'constructor'])(
      'AC-02.6.2 AC-01.6.6 a %s key → 400 naming it, team unchanged',
      async (field) => {
        const user = await signUpAndSignIn(app);
        const team = await createTeam(user);

        const response = await http()
          .put(`${TEAMS}/${team.id}`)
          .set('Authorization', bearerOf(user))
          .set('Content-Type', 'application/json')
          .send(
            `{"name":"Platform","colorHex":"#0EA5E9","${field}":{"isAdmin":true}}`,
          );

        expectInvalid(response, field);
        expect((await row(team.id))?.name).toBe('Mobile');
      },
    );

    it('AC-02.6.2 an invalid body → 400, whatever If-Match says (the header is ignored)', async () => {
      const user = await signUpAndSignIn(app);
      const team = await createTeam(user);

      expectInvalid(
        await put(user, team.id, { name: 'M', colorHex: '#7C3AED' }, 'W/"9"'),
        'name',
      );
    });

    it('a malformed id → 400 naming id', async () => {
      const user = await signUpAndSignIn(app);

      expectInvalid(
        await put(user, 'abc', { name: 'Platform', colorHex: '#0EA5E9' }),
        'id',
      );
    });
  });

  describe('not found (AC-02.6.6, AC-02.9.7, AC-01.6.3)', () => {
    it("AC-02.6.6 AC-01.6.3 a foreign team → 404 and Rafael's row is unchanged in the database", async () => {
      const { marina, rafael } = await twoUsers(app);
      const theirs = await createTeam(rafael);
      const before = await row(theirs.id);

      expectError(
        await put(marina, theirs.id, { name: 'Hijacked', colorHex: '#000000' }),
        404,
        'TEAM_NOT_FOUND',
      );
      expect(await row(theirs.id)).toEqual(before);
    });

    it('AC-02.6.6 unknown and deleted ids → 404', async () => {
      const user = await signUpAndSignIn(app);
      const gone = await createTeam(user, 'Gone');
      await sql.query('UPDATE teams SET deleted_at = now() WHERE id = $1', [
        gone.id,
      ]);

      for (const id of [UNKNOWN_ID, gone.id]) {
        expectError(
          await put(user, id, { name: 'Platform', colorHex: '#0EA5E9' }),
          404,
          'TEAM_NOT_FOUND',
        );
      }
    });

    it.each(['W/"1"', 'W/"9"', 'garbage', '*'])(
      'AC-02.6.6 an unknown team → 404 whatever If-Match says (%s; the header is ignored)',
      async (ifMatch) => {
        const { marina, rafael } = await twoUsers(app);
        const theirs = await createTeam(rafael);

        expectError(
          await put(
            marina,
            theirs.id,
            { name: 'Platform', colorHex: '#0EA5E9' },
            ifMatch,
          ),
          404,
          'TEAM_NOT_FOUND',
        );
      },
    );
  });

  describe('last write wins: If-Match is ignored (AC-08.3)', () => {
    it.each([undefined, 'W/"9"', 'W/"1"', 'abc', '*', '"0"'])(
      'AC-08.3 If-Match %j is ignored: 200, version 2, no ETag, no 412',
      async (ifMatch) => {
        const user = await signUpAndSignIn(app);
        const team = await createTeam(user);

        const response = await put(
          user,
          team.id,
          { name: 'Platform', colorHex: '#0EA5E9' },
          ifMatch,
        );

        expect(response.status).toBe(200);
        expect((response.body as { data: TeamBody }).data.version).toBe(2);
        expect(response.headers.etag).toBeUndefined();
      },
    );

    it('AC-08.3 two concurrent updates of one team both apply (last write wins)', async () => {
      const user = await signUpAndSignIn(app);
      const team = await createTeam(user);

      const responses = await Promise.all([
        put(user, team.id, { name: 'First', colorHex: '#0EA5E9' }, 'W/"1"'),
        put(user, team.id, { name: 'Second', colorHex: '#0EA5E9' }, 'W/"1"'),
      ]);

      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect((await row(team.id))?.version).toBe(3);
    });

    it('AC-02.6.4 two concurrent renames of two teams to one name → exactly one 200; the loser gets 409', async () => {
      const user = await signUpAndSignIn(app);
      const a = await createTeam(user, 'Alpha');
      const b = await createTeam(user, 'Beta');

      const responses = await Promise.all([
        put(user, a.id, { name: 'Shared', colorHex: '#0EA5E9' }),
        put(user, b.id, { name: 'shared', colorHex: '#0EA5E9' }),
      ]);

      const statuses = responses.map((response) => response.status).sort();
      // The unique index on the owner's active names decides: the loser is a name collision.
      expect(statuses).toEqual([200, 409]);
      const names = [(await row(a.id))?.name, (await row(b.id))?.name];
      expect(
        names.filter((name) => name?.toLowerCase() === 'shared'),
      ).toHaveLength(1);
    });
  });

  it('AC-02.11.2 an anonymous update → 401, the team unchanged', async () => {
    const user = await signUpAndSignIn(app);
    const team = await createTeam(user);

    const response = await http()
      .put(`${TEAMS}/${team.id}`)
      .send({ name: 'Platform', colorHex: '#0EA5E9' });

    expectError(response, 401, 'UNAUTHENTICATED');
    expect((await row(team.id))?.name).toBe('Mobile');
  });
});
