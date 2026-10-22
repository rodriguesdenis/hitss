import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from '@test/support/app';
import {
  bearerOf,
  signUpAndSignIn,
  TestUser,
  twoUsers,
} from '@test/support/auth';
import { useTestDatabase } from '@test/support/postgres';

const TEAMS = '/api/v1/teams';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

interface TeamBody {
  id: string;
  name: string;
  colorHex: string;
  description: string | null;
  taskCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

describe('POST /api/v1/teams (e2e)', () => {
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

  const create = (user: TestUser, body: unknown) =>
    request(app.getHttpServer() as App)
      .post(TEAMS)
      .set('Authorization', bearerOf(user))
      .send(body as object);

  const teamsOf = async (user: TestUser) =>
    (
      await sql.query<{ name: string; owner_id: string }>(
        'SELECT name, owner_id FROM teams WHERE owner_id = $1 ORDER BY created_at',
        [user.id],
      )
    ).rows;

  const expectInvalid = (response: Response, field: string) => {
    expect(response.status).toBe(400);
    const body = response.body as {
      error: { code: string; details: { field: string }[] };
    };
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details.map((detail) => detail.field)).toContain(field);
  };

  describe('happy path', () => {
    it('AC-02.1.1 AC-02.8.3 creates the team: envelope, Location, no ETag, trimmed name, upper-case color, taskCount 0', async () => {
      const user = await signUpAndSignIn(app);

      const response = await create(user, {
        name: '  Mobile  ',
        colorHex: '#7c3aed',
        description: '  Apps and widgets  ',
      });

      expect(response.status).toBe(201);
      const team = (response.body as { data: TeamBody }).data;
      expect(team).toEqual({
        id: expect.stringMatching(UUID) as string,
        name: 'Mobile',
        colorHex: '#7C3AED',
        description: 'Apps and widgets',
        taskCount: 0,
        version: 1,
        createdAt: expect.stringMatching(ISO) as string,
        updatedAt: team.createdAt,
      });
      expect(response.headers.location).toBe(`${TEAMS}/${team.id}`);
      expect(response.headers.etag).toBeUndefined(); // AC-08.3
    });

    it('AC-02.1.4 a blank description is stored as none; it is optional', async () => {
      const user = await signUpAndSignIn(app);

      const blank = await create(user, {
        name: 'Blank',
        colorHex: '#000000',
        description: '   ',
      });
      const absent = await create(user, {
        name: 'Absent',
        colorHex: '#000000',
      });
      const nulled = await create(user, {
        name: 'Nulled',
        colorHex: '#000000',
        description: null,
      });

      for (const response of [blank, absent, nulled]) {
        expect(response.status).toBe(201);
        expect(
          (response.body as { data: TeamBody }).data.description,
        ).toBeNull();
      }
    });

    it('AC-02.1.4 a description keeps its line breaks', async () => {
      const user = await signUpAndSignIn(app);

      const response = await create(user, {
        name: 'Lines',
        colorHex: '#000000',
        description: 'first\nsecond\r\nthird',
      });

      expect((response.body as { data: TeamBody }).data.description).toBe(
        'first\nsecond\r\nthird',
      );
    });
  });

  describe('validation (one row per rule, nothing created)', () => {
    it.each([
      ['a 1-character name', { name: 'M' }, 'name'],
      ['a 51-character name', { name: 'n'.repeat(51) }, 'name'],
      ['a blank name', { name: '   ' }, 'name'],
      ['a missing name', { name: undefined }, 'name'],
      ['a non-string name', { name: 42 }, 'name'],
      ['color #FFF', { colorHex: '#FFF' }, 'colorHex'],
      ['color 7C3AED', { colorHex: '7C3AED' }, 'colorHex'],
      ['color #7C3AED0', { colorHex: '#7C3AED0' }, 'colorHex'],
      ['color #GGGGGG', { colorHex: '#GGGGGG' }, 'colorHex'],
      ['color red', { colorHex: 'red' }, 'colorHex'],
      ['an empty color', { colorHex: '' }, 'colorHex'],
      ['a missing color', { colorHex: undefined }, 'colorHex'],
      [
        'a 281-character description',
        { description: 'd'.repeat(281) },
        'description',
      ],
    ])(
      'AC-02.1.2 AC-02.1.3 AC-02.1.4 %s → 400 naming the field',
      async (_label, override, field) => {
        const user = await signUpAndSignIn(app);

        const response = await create(user, {
          name: 'Valid',
          colorHex: '#123ABC',
          ...override,
        });

        expectInvalid(response, field);
        expect(await teamsOf(user)).toEqual([]);
      },
    );

    it.each([
      ['a newline between two words', 'Mo\nbile'],
      ['a tab between two words', 'Mo\tbile'],
      ['a NUL character', 'Mo\u0000bile'],
      ['an escape character', 'Mo\u001bbile'],
      ['a carriage return at the end', 'Mobile\r'],
      ['a leading NUL', '\u0000Mobile'],
      ['a trailing tab', 'Mobile\t'],
    ])(
      'AC-02.1.10 a name with %s → 400 naming name, nothing created',
      async (_label, name) => {
        const user = await signUpAndSignIn(app);

        const response = await create(user, { name, colorHex: '#123ABC' });

        expectInvalid(response, 'name');
        expect(await teamsOf(user)).toEqual([]);
      },
    );

    it.each([
      ['a tab between two words', 'two\twords'],
      ['a NUL character', 'ab\u0000cd'],
      ['an escape character', '\u001b[31m red'],
      ['a DEL character', 'ab\u007fcd'],
      ['a C1 control character', 'ab\u0085cd'],
      ['a tab at the end', 'Apps\t'],
      ['only a tab', '\t'],
      ['spaces and a tab and nothing else', '   \t  '],
    ])(
      'AC-02.1.11 a description with %s → 400 naming description, nothing created',
      async (_label, description) => {
        const user = await signUpAndSignIn(app);

        const response = await create(user, {
          name: 'Platform',
          colorHex: '#0EA5E9',
          description,
        });

        expectInvalid(response, 'description');
        expect(await teamsOf(user)).toEqual([]);
      },
    );

    it.each([
      ['a line feed', 'first\nsecond'],
      ['a carriage return', 'first\rsecond'],
      ['a carriage return and a line feed', 'first\r\nsecond'],
    ])(
      'AC-02.1.11 line breaks are allowed: two lines separated by %s',
      async (_label, description) => {
        const user = await signUpAndSignIn(app);

        const response = await create(user, {
          name: 'Platform',
          colorHex: '#0EA5E9',
          description,
        });

        expect(response.status).toBe(201);
        expect((response.body as { data: TeamBody }).data.description).toBe(
          description,
        );
      },
    );

    it('AC-02.1.11 AC-02.1.4 a description made only of line breaks and spaces is blank → none', async () => {
      const user = await signUpAndSignIn(app);

      const response = await create(user, {
        name: 'Platform',
        colorHex: '#0EA5E9',
        description: ' \n \r\n ',
      });

      expect(response.status).toBe(201);
      expect((response.body as { data: TeamBody }).data.description).toBeNull();
    });

    it.each([
      ['2 characters', 'Mo'],
      ['50 characters', 'n'.repeat(50)],
      ['2 characters after trimming', '  Mo  '],
    ])('AC-02.1.2 a name of %s is accepted', async (_label, name) => {
      const user = await signUpAndSignIn(app);

      expect((await create(user, { name, colorHex: '#123abc' })).status).toBe(
        201,
      );
    });

    it('AC-02.1.4 a description of exactly 280 characters after trimming is accepted', async () => {
      const user = await signUpAndSignIn(app);

      const response = await create(user, {
        name: 'Long',
        colorHex: '#123ABC',
        description: ` ${'d'.repeat(280)} `,
      });

      expect(response.status).toBe(201);
    });
  });

  describe('mass assignment (AC-02.1.8, AC-01.6.4, AC-01.6.6, AC-02.11.3)', () => {
    it.each([
      ['id', '7d0c5e2a-3f1b-4c8e-9a6d-2b4f8e1c0a93'],
      ['ownerId', 'someone-else'],
      ['owner_id', 'someone-else'],
      ['userId', 'someone-else'],
      ['owner', { id: 'someone-else' }],
      ['version', 7],
      ['taskCount', 9],
      ['updatedAt', '2020-01-01T00:00:00.000Z'],
      ['deletedAt', '2020-01-01T00:00:00.000Z'],
    ])(
      'AC-02.1.8 AC-01.6.4 AC-01.6.6 an extra %s → 400 naming it, nothing created',
      async (field, value) => {
        const user = await signUpAndSignIn(app);

        const response = await create(user, {
          name: 'Mobile',
          colorHex: '#7C3AED',
          [field]: value,
        });

        expectInvalid(response, field);
        expect(await teamsOf(user)).toEqual([]);
      },
    );

    it.each(['__proto__', 'constructor'])(
      'AC-02.1.8 AC-01.6.6 a %s key → 400 naming it, nothing created',
      async (field) => {
        const user = await signUpAndSignIn(app);
        // A raw JSON body: an object literal would not carry __proto__ as an own key.
        const response = await request(app.getHttpServer() as App)
          .post(TEAMS)
          .set('Authorization', bearerOf(user))
          .set('Content-Type', 'application/json')
          .send(
            `{"name":"Mobile","colorHex":"#7C3AED","${field}":{"isAdmin":true}}`,
          );

        expectInvalid(response, field);
        expect(await teamsOf(user)).toEqual([]);
      },
    );

    it('AC-02.11.3 the owner of the new team is always the signed-in user', async () => {
      const user = await signUpAndSignIn(app);

      await create(user, { name: 'Mine', colorHex: '#7C3AED' });

      expect(await teamsOf(user)).toEqual([
        { name: 'Mine', owner_id: user.id },
      ]);
    });
  });

  describe('names are unique per owner, among active teams', () => {
    it.each(['mobile', 'MOBILE', ' Mobile ', 'Mobile'])(
      'AC-02.1.5 "%s" after "Mobile" → 409 TEAM_NAME_ALREADY_EXISTS, nothing created',
      async (name) => {
        const user = await signUpAndSignIn(app);
        await create(user, { name: 'Mobile', colorHex: '#7C3AED' });

        const response = await create(user, { name, colorHex: '#000000' });

        expect(response.status).toBe(409);
        expect(response.body).toEqual({
          error: {
            code: 'TEAM_NAME_ALREADY_EXISTS',
            message: 'A team with this name already exists.',
            traceId: expect.any(String) as string,
          },
        });
        expect(await teamsOf(user)).toHaveLength(1);
      },
    );

    it('AC-02.1.6 AC-02.11.4 Marina and Rafael can both create "Mobile", and each sees only their own', async () => {
      const { marina, rafael } = await twoUsers(app);

      const mine = await create(marina, {
        name: 'Mobile',
        colorHex: '#7C3AED',
      });
      const theirs = await create(rafael, {
        name: 'Mobile',
        colorHex: '#000000',
      });

      expect([mine.status, theirs.status]).toEqual([201, 201]);
      expect(await teamsOf(marina)).toEqual([
        { name: 'Mobile', owner_id: marina.id },
      ]);
      expect(await teamsOf(rafael)).toEqual([
        { name: 'Mobile', owner_id: rafael.id },
      ]);
    });

    it('AC-02.1.7 a deleted team does not reserve its name', async () => {
      const user = await signUpAndSignIn(app);
      const first = await create(user, { name: 'Mobile', colorHex: '#7C3AED' });
      await sql.query('UPDATE teams SET deleted_at = now() WHERE id = $1', [
        (first.body as { data: TeamBody }).data.id,
      ]);

      expect(
        (await create(user, { name: 'Mobile', colorHex: '#7C3AED' })).status,
      ).toBe(201);
    });

    it('AC-02.1.9 two concurrent creates of one name → exactly one 201 and one 409', async () => {
      const user = await signUpAndSignIn(app);

      const responses = await Promise.all([
        create(user, { name: 'Race', colorHex: '#7C3AED' }),
        create(user, { name: 'race', colorHex: '#000000' }),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      expect(await teamsOf(user)).toHaveLength(1);
    });
  });

  it('AC-02.11.2 AC-01.5.1 an anonymous create → 401, nothing created', async () => {
    const before = Number(
      (await sql.query<{ n: string }>('SELECT count(*) AS n FROM teams'))
        .rows[0]?.n,
    );

    const response = await request(app.getHttpServer() as App)
      .post(TEAMS)
      .send({ name: 'Mobile', colorHex: '#7C3AED' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    expect(
      Number(
        (await sql.query<{ n: string }>('SELECT count(*) AS n FROM teams'))
          .rows[0]?.n,
      ),
    ).toBe(before);
  });
});
