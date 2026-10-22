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
const UNKNOWN_ID = '0b7a3c1e-2d4f-4a6b-8c9d-1e2f3a4b5c6d';

interface TeamBody {
  id: string;
  name: string;
  version: number;
}

describe('DELETE /api/v1/teams/:id and ownership (e2e)', () => {
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
  ): Promise<TeamBody> => {
    const response = await http()
      .post(TEAMS)
      .set('Authorization', bearerOf(user))
      .send({ name, colorHex: '#7C3AED' });
    expect(response.status).toBe(201);
    return (response.body as { data: TeamBody }).data;
  };

  const remove = (user: TestUser, id: string, ifMatch?: string) => {
    const call = http()
      .delete(`${TEAMS}/${id}`)
      .set('Authorization', bearerOf(user));
    return ifMatch === undefined ? call : call.set('If-Match', ifMatch);
  };

  const row = async (id: string) =>
    (
      await sql.query<{ name: string; version: number; deleted: boolean }>(
        'SELECT name, version, deleted_at IS NOT NULL AS deleted FROM teams WHERE id = $1',
        [id],
      )
    ).rows[0];

  /** The error body without its per-request traceId, to compare 404s byte for byte. */
  const withoutTraceId = (response: Response): string => {
    const { traceId, ...rest } = (
      response.body as { error: Record<string, unknown> }
    ).error;
    expect(typeof traceId).toBe('string');
    return JSON.stringify({ error: rest });
  };

  const expectNotFound = (response: Response) => {
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'TEAM_NOT_FOUND' } });
  };

  it('AC-02.7.1 204, then get → 404 and the list excludes it', async () => {
    const user = await signUpAndSignIn(app);
    const team = await createTeam(user);
    await createTeam(user, 'Kept');

    const response = await remove(user, team.id, 'W/"1"');

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expectNotFound(
      await http()
        .get(`${TEAMS}/${team.id}`)
        .set('Authorization', bearerOf(user)),
    );
    const list = await http().get(TEAMS).set('Authorization', bearerOf(user));
    expect((list.body as { data: TeamBody[] }).data.map((t) => t.name)).toEqual(
      ['Kept'],
    );
    expect(await row(team.id)).toMatchObject({ deleted: true, version: 2 });
  });

  it('AC-02.7.1 without If-Match the delete proceeds', async () => {
    const user = await signUpAndSignIn(app);
    const team = await createTeam(user);

    expect((await remove(user, team.id)).status).toBe(204);
  });

  it('AC-02.7.3 deleting again, or an unknown id → 404', async () => {
    const user = await signUpAndSignIn(app);
    const team = await createTeam(user);
    await remove(user, team.id);

    expectNotFound(await remove(user, team.id));
    expectNotFound(await remove(user, UNKNOWN_ID));
  });

  it.each([undefined, 'W/"1"', 'W/"9"', '*', 'garbage'])(
    "AC-02.7.3 AC-01.6.3 a foreign team with If-Match %j → 404 identical to an unknown id; Rafael's team unchanged",
    async (ifMatch) => {
      const { marina, rafael } = await twoUsers(app);
      const theirs = await createTeam(rafael);
      const before = await row(theirs.id);

      const foreign = await remove(marina, theirs.id, ifMatch);
      const unknown = await remove(marina, UNKNOWN_ID, ifMatch);

      expectNotFound(foreign);
      expect(withoutTraceId(foreign)).toBe(withoutTraceId(unknown));
      expect(await row(theirs.id)).toEqual(before);
    },
  );

  it.each(['W/"2"', 'W/"1"', 'abc', '*'])(
    'AC-08.3 If-Match %s is ignored: the delete proceeds (204), no 412',
    async (ifMatch) => {
      const user = await signUpAndSignIn(app);
      const team = await createTeam(user);

      const response = await remove(user, team.id, ifMatch);

      expect(response.status).toBe(204);
      expect(await row(team.id)).toMatchObject({ deleted: true, version: 2 });
    },
  );

  it('a malformed id → 400 naming id; anonymous → 401', async () => {
    const user = await signUpAndSignIn(app);
    const team = await createTeam(user);

    const malformed = await remove(user, 'abc');
    expect(malformed.status).toBe(400);
    expect(malformed.body).toMatchObject({
      error: { details: [{ field: 'id' }] },
    });
    const anonymous = await http().delete(`${TEAMS}/${team.id}`);
    expect(anonymous.status).toBe(401);
    expect((await row(team.id))?.deleted).toBe(false);
  });

  it("AC-02.11.1 list, search, get, replace and delete never expose or change Rafael's teams; by-id 404s are byte-identical", async () => {
    const { marina, rafael } = await twoUsers(app);
    const theirs = await createTeam(rafael, 'Rafael Mobile');
    await createTeam(marina, 'Marina Backend');
    const before = await row(theirs.id);
    const as = (path: string) =>
      http().get(path).set('Authorization', bearerOf(marina));

    const list = await as(TEAMS);
    const search = await as(`${TEAMS}?search=rafael`);
    expect((list.body as { data: TeamBody[] }).data.map((t) => t.name)).toEqual(
      ['Marina Backend'],
    );
    expect((search.body as { meta: { total: number } }).meta.total).toBe(0);

    const byId = [
      await as(`${TEAMS}/${theirs.id}`),
      await http()
        .put(`${TEAMS}/${theirs.id}`)
        .set('Authorization', bearerOf(marina))
        .send({ name: 'Hijacked', colorHex: '#000000' }),
      await remove(marina, theirs.id),
    ];
    const unknown = await as(`${TEAMS}/${UNKNOWN_ID}`);
    for (const response of byId) {
      expectNotFound(response);
      expect(withoutTraceId(response)).toBe(withoutTraceId(unknown));
    }
    expect(await row(theirs.id)).toEqual(before);
  });
});
