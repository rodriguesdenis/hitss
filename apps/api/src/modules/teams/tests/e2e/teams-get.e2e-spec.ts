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

describe('GET /api/v1/teams/:id (e2e)', () => {
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

  const createTeam = async (user: TestUser, name = 'Mobile') => {
    const response = await http()
      .post(TEAMS)
      .set('Authorization', bearerOf(user))
      .send({ name, colorHex: '#7c3aed', description: 'Apps' });
    expect(response.status).toBe(201);
    return response;
  };

  const get = (user: TestUser, id: string) =>
    http().get(`${TEAMS}/${id}`).set('Authorization', bearerOf(user));

  /** The body without its per-request traceId, to compare 404s byte for byte. */
  const withoutTraceId = (response: Response): string => {
    const body = response.body as { error: Record<string, unknown> };
    const { traceId, ...rest } = body.error;
    expect(typeof traceId).toBe('string');
    return JSON.stringify({ error: rest });
  };

  it('AC-02.5.1 AC-08.3 returns my team with taskCount and version, and no ETag', async () => {
    const user = await signUpAndSignIn(app);
    const created = await createTeam(user);
    const { id } = (created.body as { data: { id: string } }).data;

    const response = await get(user, id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(created.body);
    expect(response.body).toMatchObject({
      data: { id, taskCount: 0, version: 1 },
    });
    expect(response.headers.etag).toBeUndefined();
  });

  it('AC-02.5.1 the version is returned as data (informational, last write wins)', async () => {
    const user = await signUpAndSignIn(app);
    const { id } = ((await createTeam(user)).body as { data: { id: string } })
      .data;
    await sql.query('UPDATE teams SET version = 4 WHERE id = $1', [id]);

    const response = await get(user, id);

    expect(response.body).toMatchObject({ data: { version: 4 } });
    expect(response.headers.etag).toBeUndefined();
  });

  it('AC-02.5.2 AC-02.5.3 AC-02.5.4 AC-01.6.2 unknown, foreign and deleted ids give byte-identical 404 bodies (apart from traceId)', async () => {
    const { marina, rafael } = await twoUsers(app);
    const foreign = (
      (await createTeam(rafael)).body as { data: { id: string } }
    ).data.id;
    const deleted = (
      (await createTeam(marina, 'Gone')).body as { data: { id: string } }
    ).data.id;
    await sql.query('UPDATE teams SET deleted_at = now() WHERE id = $1', [
      deleted,
    ]);

    const responses = await Promise.all(
      [UNKNOWN_ID, foreign, deleted].map((id) => get(marina, id)),
    );

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.headers.etag).toBeUndefined();
    }
    const bodies = responses.map(withoutTraceId);
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0] ?? '')).toEqual({
      error: { code: 'TEAM_NOT_FOUND', message: 'Team not found.' },
    });
    // Rafael still sees his own team.
    expect((await get(rafael, foreign)).status).toBe(200);
  });

  it.each(['abc', '123', `${UNKNOWN_ID}x`, 'not-a-uuid-at-all'])(
    'AC-02.5.5 a malformed id %j → 400 naming id',
    async (id) => {
      const user = await signUpAndSignIn(app);

      const response = await get(user, id);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: { code: 'VALIDATION_FAILED', details: [{ field: 'id' }] },
      });
    },
  );

  it('AC-01.5.5 anonymous with an existing id → the same 401 as with an unknown or malformed id', async () => {
    const user = await signUpAndSignIn(app);
    const { id } = ((await createTeam(user)).body as { data: { id: string } })
      .data;

    const responses = await Promise.all(
      [id, UNKNOWN_ID, 'abc'].map((target) => http().get(`${TEAMS}/${target}`)),
    );

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: { code: 'UNAUTHENTICATED' },
      });
    }
  });
});
