import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from '../support/app';
import { bearerOf, signUpAndSignIn, TestUser, twoUsers } from '../support/auth';
import { useTestDatabase } from '../support/postgres';

const TEAMS = '/api/v1/teams';

interface TeamBody {
  id: string;
  name: string;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}
interface PageBody {
  data: TeamBody[];
  meta: { total: number; limit: number; offset: number; hasNextPage: boolean };
}

describe('GET /api/v1/teams (e2e)', () => {
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

  /** Creates the teams in order through the API; returns their ids. */
  const seed = async (user: TestUser, names: string[]): Promise<string[]> => {
    const ids: string[] = [];
    for (const name of names) {
      const response = await http()
        .post(TEAMS)
        .set('Authorization', bearerOf(user))
        .send({ name, colorHex: '#7C3AED' });
      expect(response.status).toBe(201);
      ids.push((response.body as { data: { id: string } }).data.id);
    }
    return ids;
  };

  /** Spreads the teams' timestamps one minute apart, oldest first, in the given order. */
  const spreadCreatedAt = async (ids: string[]) => {
    for (const [index, id] of ids.entries()) {
      await sql.query(
        `UPDATE teams SET created_at = timestamptz '2026-01-01T00:00:00Z' + $2 * interval '1 minute',
                          updated_at = timestamptz '2026-01-01T00:00:00Z' + $2 * interval '1 minute'
          WHERE id = $1`,
        [id, index],
      );
    }
  };

  const list = (
    user: TestUser,
    query: Record<string, string | string[]> = {},
  ) => http().get(TEAMS).set('Authorization', bearerOf(user)).query(query);

  const page = (response: Response): PageBody => {
    expect(response.status).toBe(200);
    return response.body as PageBody;
  };
  const names = (response: Response) =>
    page(response).data.map((team) => team.name);

  const expectInvalid = (response: Response, field: string) => {
    expect(response.status).toBe(400);
    const body = response.body as {
      error: { code: string; details: { field: string }[] };
    };
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details.map((detail) => detail.field)).toContain(field);
  };

  describe('listing and paging', () => {
    it("AC-02.2.1 AC-01.6.1 lists only my active teams with meta; Rafael's never appear nor count", async () => {
      const { marina, rafael } = await twoUsers(app);
      await seed(marina, ['Mobile', 'Backend']);
      await seed(rafael, ['Mobile', 'Rafael Only', 'Ops']);

      const body = page(await list(marina));

      expect(body.data.map((team) => team.name).sort()).toEqual([
        'Backend',
        'Mobile',
      ]);
      expect(body.meta).toEqual({
        total: 2,
        limit: 20,
        offset: 0,
        hasNextPage: false,
      });
      expect(body.data.every((team) => team.taskCount === 0)).toBe(true);
    });

    it('AC-02.2.2 without parameters: limit 20, offset 0, newest first', async () => {
      const user = await signUpAndSignIn(app);
      const ids = await seed(user, ['First', 'Second', 'Third']);
      await spreadCreatedAt(ids);

      const response = await list(user);

      expect(names(response)).toEqual(['Third', 'Second', 'First']);
      expect(page(response).meta).toMatchObject({ limit: 20, offset: 0 });
    });

    it('AC-02.2.3 25 teams with limit=10: offsets 0 and 10 have a next page, 20 returns 5; total 25 on every page', async () => {
      const user = await signUpAndSignIn(app);
      await seed(
        user,
        Array.from(
          { length: 25 },
          (_, i) => `Team ${String(i).padStart(2, '0')}`,
        ),
      );

      const pages = await Promise.all(
        ['0', '10', '20'].map(async (offset) =>
          page(await list(user, { limit: '10', offset })),
        ),
      );

      expect(
        pages.map((p) => [p.data.length, p.meta.total, p.meta.hasNextPage]),
      ).toEqual([
        [10, 25, true],
        [10, 25, true],
        [5, 25, false],
      ]);
    });

    it('AC-02.2.4 an offset at or past the end is an empty page, total 3, no next page', async () => {
      const user = await signUpAndSignIn(app);
      await seed(user, ['A1', 'B2', 'C3']);

      for (const offset of ['3', '50']) {
        expect(page(await list(user, { offset }))).toEqual({
          data: [],
          meta: {
            total: 3,
            limit: 20,
            offset: Number(offset),
            hasNextPage: false,
          },
        });
      }
    });

    it('AC-02.2.6 no teams → an empty list, total 0', async () => {
      const user = await signUpAndSignIn(app);

      expect(page(await list(user))).toEqual({
        data: [],
        meta: { total: 0, limit: 20, offset: 0, hasNextPage: false },
      });
    });

    it('AC-02.2.7 a deleted team is neither listed nor counted', async () => {
      const user = await signUpAndSignIn(app);
      const [gone] = await seed(user, ['Gone', 'Kept']);
      await sql.query('UPDATE teams SET deleted_at = now() WHERE id = $1', [
        gone,
      ]);

      const body = page(await list(user));

      expect(body.data.map((team) => team.name)).toEqual(['Kept']);
      expect(body.meta.total).toBe(1);
    });

    it.each([
      '-createdAt',
      'createdAt',
      '-updatedAt',
      'updatedAt',
      'name',
      '-name',
    ])(
      'AC-02.2.8 teams created at the same instant page exactly once each with sort=%s',
      async (sort) => {
        const user = await signUpAndSignIn(app);
        const ids = await seed(user, [
          'Tie A',
          'Tie B',
          'Tie C',
          'Tie D',
          'Tie E',
        ]);
        await sql.query(
          `UPDATE teams SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z'
            WHERE owner_id = $1`,
          [user.id],
        );

        const seen: string[] = [];
        for (const offset of ['0', '2', '4']) {
          seen.push(
            ...page(await list(user, { sort, limit: '2', offset })).data.map(
              (t) => t.id,
            ),
          );
        }

        expect(seen).toHaveLength(5);
        expect([...seen].sort()).toEqual([...ids].sort());
      },
    );

    it.each([
      [{ limit: '0' }, 'limit'],
      [{ limit: '101' }, 'limit'],
      [{ limit: '1.5' }, 'limit'],
      [{ limit: 'ten' }, 'limit'],
      [{ limit: ['10', '20'] }, 'limit'],
      [{ offset: '-1' }, 'offset'],
      [{ offset: 'x' }, 'offset'],
      [{ offset: '99999999999999999999' }, 'offset'],
    ])('AC-02.2.5 %j → 400 naming the parameter', async (query, field) => {
      const user = await signUpAndSignIn(app);

      expectInvalid(await list(user, query), field);
    });

    it.each(['color', 'page', 'ownerId'])(
      'AC-02.2.9 an unknown parameter %s → 400 naming it',
      async (parameter) => {
        const user = await signUpAndSignIn(app);

        expectInvalid(await list(user, { [parameter]: 'x' }), parameter);
      },
    );
  });

  describe('search', () => {
    it('AC-02.3.1 "mob" matches "Mobile" and "Mobile QA", case-insensitive substring, total 2', async () => {
      const user = await signUpAndSignIn(app);
      await seed(user, ['Mobile', 'Backend', 'Mobile QA']);

      const body = page(await list(user, { search: 'mob', sort: 'name' }));

      expect(body.data.map((team) => team.name)).toEqual([
        'Mobile',
        'Mobile QA',
      ]);
      expect(body.meta.total).toBe(2);
    });

    it('AC-02.3.2 the term is trimmed before matching', async () => {
      const user = await signUpAndSignIn(app);
      await seed(user, ['Mobile', 'Backend']);

      expect(names(await list(user, { search: '  MOB  ' }))).toEqual([
        'Mobile',
      ]);
    });

    it.each([
      ['blank', ''],
      ['whitespace only', '   '],
      ['101 characters', 's'.repeat(101)],
    ])('AC-02.3.2 a %s term → 400 naming search', async (_label, search) => {
      const user = await signUpAndSignIn(app);

      expectInvalid(await list(user, { search }), 'search');
    });

    it.each([
      ['%', '50% Growth'],
      ['_', 'Team_A'],
      ['\\', 'Back\\slash'],
    ])(
      'AC-02.3.3 "%s" matches only the name that literally contains it',
      async (search, match) => {
        const user = await signUpAndSignIn(app);
        await seed(user, [
          '50% Growth',
          'Team_A',
          'Back\\slash',
          'TeamXA',
          'Plain',
        ]);

        const body = page(await list(user, { search }));

        expect(body.data.map((team) => team.name)).toEqual([match]);
        expect(body.meta.total).toBe(1);
      },
    );

    it.each([`'; DROP TABLE teams;--`, 'a\\b', `" OR 1=1 --`])(
      'AC-02.3.3 a term with quotes or backslashes (%s) is matched literally → 200, empty list',
      async (search) => {
        const user = await signUpAndSignIn(app);
        await seed(user, ['Mobile']);

        expect(page(await list(user, { search }))).toEqual({
          data: [],
          meta: { total: 0, limit: 20, offset: 0, hasNextPage: false },
        });
        expect(page(await list(user)).meta.total).toBe(1); // the table is still there
      },
    );

    it('AC-02.3.4 no match → an empty list, total 0', async () => {
      const user = await signUpAndSignIn(app);
      await seed(user, ['Mobile']);

      expect(page(await list(user, { search: 'zzz' }))).toEqual({
        data: [],
        meta: { total: 0, limit: 20, offset: 0, hasNextPage: false },
      });
    });

    it("AC-02.3.5 search never matches another user's teams", async () => {
      const { marina, rafael } = await twoUsers(app);
      await seed(rafael, ['Mobile Rafael']);
      await seed(marina, ['Backend']);

      expect(page(await list(marina, { search: 'mobile' })).meta.total).toBe(0);
    });
  });

  describe('sort', () => {
    it('AC-02.4.1 sort=name is alphabetical and case-insensitive; -name reverses it', async () => {
      const user = await signUpAndSignIn(app);
      await seed(user, ['beta', 'Alpha', 'Gamma']);

      expect(names(await list(user, { sort: 'name' }))).toEqual([
        'Alpha',
        'beta',
        'Gamma',
      ]);
      expect(names(await list(user, { sort: '-name' }))).toEqual([
        'Gamma',
        'beta',
        'Alpha',
      ]);
    });

    it('AC-02.4.2 createdAt and updatedAt sort both ways', async () => {
      const user = await signUpAndSignIn(app);
      const ids = await seed(user, ['Old', 'Mid', 'New']);
      await spreadCreatedAt(ids);
      // Updated in the opposite order: Old was touched last.
      await sql.query(
        `UPDATE teams SET updated_at = '2026-06-01T00:00:00Z' WHERE id = $1`,
        [ids[0]],
      );

      expect(names(await list(user, { sort: 'createdAt' }))).toEqual([
        'Old',
        'Mid',
        'New',
      ]);
      expect(names(await list(user, { sort: '-createdAt' }))).toEqual([
        'New',
        'Mid',
        'Old',
      ]);
      expect(names(await list(user, { sort: 'updatedAt' }))).toEqual([
        'Mid',
        'New',
        'Old',
      ]);
      expect(names(await list(user, { sort: '-updatedAt' }))).toEqual([
        'Old',
        'New',
        'Mid',
      ]);
    });

    it.each(['color', 'taskCount', '--name', '', 'NAME'])(
      'AC-02.4.3 sort=%j → 400 naming sort',
      async (sort) => {
        const user = await signUpAndSignIn(app);

        expectInvalid(await list(user, { sort }), 'sort');
      },
    );

    it('AC-02.4.4 search, sort and paging together: order applies before paging, total counts all matches', async () => {
      const user = await signUpAndSignIn(app);
      await seed(user, ['Team d', 'Other', 'team B', 'TEAM a', 'Team c']);

      const first = page(
        await list(user, { search: 'team', sort: '-name', limit: '2' }),
      );
      const second = page(
        await list(user, {
          search: 'team',
          sort: '-name',
          limit: '2',
          offset: '2',
        }),
      );

      expect(first.data.map((team) => team.name)).toEqual(['Team d', 'Team c']);
      expect(second.data.map((team) => team.name)).toEqual([
        'team B',
        'TEAM a',
      ]);
      expect([first.meta, second.meta]).toEqual([
        { total: 4, limit: 2, offset: 0, hasNextPage: true },
        { total: 4, limit: 2, offset: 2, hasNextPage: false },
      ]);
    });
  });

  it('AC-02.11.2 an anonymous list → 401', async () => {
    const response = await http().get(TEAMS);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });
});
