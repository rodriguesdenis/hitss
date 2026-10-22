import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import { DeleteTeamUseCase } from '../../application/use-cases/delete-team.use-case';
import { createTestApp } from '@test/support/app';
import { signUpAndSignIn } from '@test/support/auth';
import { useTestDatabase } from '@test/support/postgres';

const CREATED = new Date('2026-10-20T13:00:00.000Z');

/**
 * Deleting a team (T-008-06, ADR-0020): one Prisma transaction soft-deletes the team, bumps the
 * version and updated time of the owner's live tasks linked to it, and removes its task_teams
 * rows. Either all three apply or none does.
 */
describe('DeleteTeam in one transaction (integration)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let sql: Client;
  let owner = '';

  beforeAll(async () => {
    app = await createTestApp(db.url, {
      config: { authRateLimitEnabled: false },
    });
    sql = new Client({ connectionString: db.url });
    await sql.connect();
    owner = (await signUpAndSignIn(app)).id;
  });

  afterAll(async () => {
    await sql?.end();
    await app?.close();
  });

  const deleteTeam = (id: string, ownerId = owner) =>
    app.get(DeleteTeamUseCase, { strict: false }).execute({ ownerId, id });

  const team = async (name: string): Promise<string> => {
    const id = randomUUID();
    await sql.query(
      `INSERT INTO teams (id, owner_id, name, color_hex, version, created_at, updated_at)
       VALUES ($1, $2, $3, '#7C3AED', 1, $4, $4)`,
      [id, owner, `${name}-${id.slice(0, 8)}`, CREATED],
    );
    return id;
  };
  const task = async (
    teamIds: string[],
    extra: { ownerId?: string; deleted?: boolean } = {},
  ): Promise<string> => {
    const id = randomUUID();
    await sql.query(
      `INSERT INTO tasks (id, owner_id, title, status, version, created_at, updated_at, deleted_at)
       VALUES ($1, $2, 'Release', 'PENDING', 1, $3, $3, $4)`,
      [id, extra.ownerId ?? owner, CREATED, extra.deleted ? CREATED : null],
    );
    for (const teamId of teamIds) {
      await sql.query(
        'INSERT INTO task_teams (task_id, team_id) VALUES ($1, $2)',
        [id, teamId],
      );
    }
    return id;
  };
  const teamDeleted = async (id: string) =>
    (
      await sql.query<{ deleted: boolean; version: number }>(
        'SELECT deleted_at IS NOT NULL AS deleted, version FROM teams WHERE id = $1',
        [id],
      )
    ).rows[0];
  const taskState = async (id: string) => {
    const { rows } = await sql.query<{ version: number; updated_at: Date }>(
      'SELECT version, updated_at FROM tasks WHERE id = $1',
      [id],
    );
    const links = await sql.query<{ team_id: string }>(
      'SELECT team_id FROM task_teams WHERE task_id = $1 ORDER BY team_id',
      [id],
    );
    return {
      version: rows[0]?.version,
      updatedAt: rows[0]?.updated_at,
      teamIds: links.rows.map((row) => row.team_id),
    };
  };

  it('AC-02.7.2 AC-03.13.1 AC-03.13.2 AC-03.13.4 AC-08.4 unassigns the team from its tasks: only that team, version + 1, a new updated time', async () => {
    const mobile = await team('Mobile');
    const backend = await team('Backend');
    const both = await task([mobile, backend]);
    const mobileOnly = await task([mobile]);
    const backendOnly = await task([backend]);

    await deleteTeam(mobile);

    expect(await teamDeleted(mobile)).toEqual({ deleted: true, version: 2 });
    const bothState = await taskState(both);
    expect(bothState.teamIds).toEqual([backend]);
    expect(bothState.version).toBe(2);
    expect(bothState.updatedAt?.getTime()).toBeGreaterThan(CREATED.getTime());
    expect(await taskState(mobileOnly)).toMatchObject({
      teamIds: [],
      version: 2,
    });
    expect(await taskState(backendOnly)).toEqual({
      teamIds: [backend],
      version: 1,
      updatedAt: CREATED,
    });
  });

  it('a soft-deleted task linked to the team is not bumped, and its link goes with the others', async () => {
    const mobile = await team('Mobile');
    const archived = await task([mobile], { deleted: true });

    await deleteTeam(mobile);

    expect(await taskState(archived)).toEqual({
      teamIds: [],
      version: 1,
      updatedAt: CREATED,
    });
  });

  it('AC-02.7.4 AC-08.4 a failing last statement rolls everything back: team active, task versions and links intact', async () => {
    const mobile = await team('Mobile');
    const linked = await task([mobile]);
    // Test-only trigger: deleting this team's links fails, after the soft delete and the bump.
    await sql.query(`
      CREATE OR REPLACE FUNCTION fail_link_delete() RETURNS trigger AS $$
      BEGIN
        IF OLD.team_id = '${mobile}'::uuid THEN
          RAISE EXCEPTION 'forced failure';
        END IF;
        RETURN OLD;
      END $$ LANGUAGE plpgsql`);
    await sql.query(`
      CREATE TRIGGER fail_link_delete BEFORE DELETE ON task_teams
      FOR EACH ROW EXECUTE FUNCTION fail_link_delete()`);
    try {
      await expect(deleteTeam(mobile)).rejects.toThrow();
    } finally {
      await sql.query('DROP TRIGGER fail_link_delete ON task_teams');
      await sql.query('DROP FUNCTION fail_link_delete()');
    }

    expect(await teamDeleted(mobile)).toEqual({ deleted: false, version: 1 });
    expect(await taskState(linked)).toEqual({
      teamIds: [mobile],
      version: 1,
      updatedAt: CREATED,
    });
  });

  it("another user's tasks are never touched", async () => {
    const mobile = await team('Mobile');
    const stranger = (await signUpAndSignIn(app)).id;
    // A foreign task cannot link a team of mine through the API; seeded directly to prove the
    // owner filter of the bump.
    const theirs = await task([mobile], { ownerId: stranger });

    await deleteTeam(mobile);

    expect(await taskState(theirs)).toMatchObject({ version: 1 });
  });
});
