import { randomUUID } from 'node:crypto';
import { INestApplication, Injectable, Module } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { TransactionHost } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';
import { Client } from 'pg';
import {
  InTransactionEventHandler,
  InTransactionHandler,
} from '../../src/shared/application/in-transaction-handler';
import type { PrismaTransactionHost } from '../../src/shared/infrastructure/transactions/cls-unit-of-work';
import { DeleteTeamUseCase } from '../../src/modules/teams/application/use-cases/delete-team.use-case';
import { TeamDeleted } from '../../src/modules/teams/domain/entities/team.events';
import { createTestApp } from '../support/app';
import { signUpAndSignIn } from '../support/auth';
import { useTestDatabase } from '../support/postgres';

/** A real user: teams.owner_id references users. */
let OWNER = '';

/** What the in-transaction reaction does on the next TeamDeleted. */
const reaction = { fail: false };

/** A reaction that writes in the same transaction (renames a sibling team), then maybe fails. */
@Injectable()
@InTransactionHandler(TeamDeleted)
class SiblingWriter implements InTransactionEventHandler<TeamDeleted> {
  static siblingId = '';

  constructor(private readonly txHost: TransactionHost) {}

  async handle(): Promise<void> {
    await (this.txHost as PrismaTransactionHost).tx.team.update({
      where: { id: SiblingWriter.siblingId },
      data: { description: 'touched by the reaction' },
    });
    if (reaction.fail) {
      throw new Error('in-transaction reaction failed');
    }
  }
}

/** After commit: records whether the delete was already visible from another connection. */
@EventsHandler(TeamDeleted)
class AfterCommitProbe implements IEventHandler<TeamDeleted> {
  static seen: { teamId: string; committed: boolean }[] = [];
  static sql: Client;
  private static listeners: (() => boolean)[] = [];

  /**
   * Resolves once this team's after-commit event has been recorded; rejects after `timeoutMs`
   * (bounded like LogCapture.waitFor), so a missing event fails fast instead of hanging.
   */
  static waitFor(teamId: string, timeoutMs = 3_000): Promise<void> {
    return new Promise((resolve, reject) => {
      const arrived = () =>
        AfterCommitProbe.seen.some((entry) => entry.teamId === teamId);
      if (arrived()) {
        resolve();
        return;
      }
      const listener = () => {
        if (!arrived()) {
          return false;
        }
        clearTimeout(timer);
        resolve();
        return true;
      };
      const timer = setTimeout(() => {
        AfterCommitProbe.listeners = AfterCommitProbe.listeners.filter(
          (l) => l !== listener,
        );
        reject(
          new Error(
            `no after-commit TeamDeleted for ${teamId} within ${timeoutMs} ms`,
          ),
        );
      }, timeoutMs);
      AfterCommitProbe.listeners.push(listener);
    });
  }

  async handle(event: TeamDeleted): Promise<void> {
    const { rows } = await AfterCommitProbe.sql.query<{ deleted: boolean }>(
      'SELECT deleted_at IS NOT NULL AS deleted FROM teams WHERE id = $1',
      [event.teamId],
    );
    AfterCommitProbe.seen.push({
      teamId: event.teamId,
      committed: rows[0]?.deleted ?? false,
    });
    // Notify the waiters; the ones that resolved drop out.
    AfterCommitProbe.listeners = AfterCommitProbe.listeners.filter(
      (listener) => !listener(),
    );
  }
}

@Module({ providers: [SiblingWriter, AfterCommitProbe] })
class ProbeModule {}

describe('UnitOfWork and the two-phase publisher (integration, T-002-09)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let sql: Client;

  beforeAll(async () => {
    app = await createTestApp(db.url, { imports: [ProbeModule] });
    sql = new Client({ connectionString: db.url });
    await sql.connect();
    AfterCommitProbe.sql = sql;
    OWNER = (await signUpAndSignIn(app)).id;
  });

  afterAll(async () => {
    await sql.end();
    await app.close();
  });

  beforeEach(() => {
    AfterCommitProbe.seen = [];
    reaction.fail = false;
  });

  const insertTeam = async (name: string): Promise<string> => {
    const id = randomUUID();
    await sql.query(
      `INSERT INTO teams (id, owner_id, name, color_hex, description, version, created_at, updated_at)
       VALUES ($1, $2, $3, '#7C3AED', NULL, 1, now(), now())`,
      [id, OWNER, `${name}-${id.slice(0, 8)}`],
    );
    return id;
  };

  const state = async (id: string) =>
    (
      await sql.query<{
        deleted: boolean;
        description: string | null;
        version: number;
      }>(
        'SELECT deleted_at IS NOT NULL AS deleted, description, version FROM teams WHERE id = $1',
        [id],
      )
    ).rows[0];

  /** Runs the command in a CLS context, as the request middleware does for HTTP. */
  const deleteTeam = (id: string) =>
    app
      .get(ClsService)
      .run(() =>
        app
          .get(DeleteTeamUseCase, { strict: false })
          .execute({ ownerId: OWNER, id }),
      );

  it('AC-02.7.4 a failing in-transaction reaction rolls the soft delete back: the team stays active', async () => {
    const team = await insertTeam('Rollback');
    SiblingWriter.siblingId = await insertTeam('Sibling');
    reaction.fail = true;

    await expect(deleteTeam(team)).rejects.toThrow(
      'in-transaction reaction failed',
    );

    expect(await state(team)).toEqual({
      deleted: false,
      description: null,
      version: 1,
    });
    // The reaction's own write rolled back with it.
    expect((await state(SiblingWriter.siblingId))?.description).toBeNull();
    // Sentinel: a later, succeeding delete. After-commit events are delivered in order, so once
    // the sentinel's has arrived, an event leaked by the failed delete would already be visible.
    reaction.fail = false;
    const sentinel = await insertTeam('Sentinel');
    await deleteTeam(sentinel);
    await AfterCommitProbe.waitFor(sentinel);
    expect(AfterCommitProbe.seen).toEqual([
      { teamId: sentinel, committed: true },
    ]);
  });

  it('AC-02.7.3 a succeeding reaction commits together with the soft delete', async () => {
    const team = await insertTeam('Commit');
    SiblingWriter.siblingId = await insertTeam('Sibling');

    await deleteTeam(team);

    expect(await state(team)).toMatchObject({ deleted: true, version: 2 });
    expect((await state(SiblingWriter.siblingId))?.description).toBe(
      'touched by the reaction',
    );
  });

  it('AC-02.7.3 after-commit handlers run only after the commit is visible to other connections', async () => {
    const team = await insertTeam('After');
    SiblingWriter.siblingId = await insertTeam('Sibling');

    await deleteTeam(team);
    await AfterCommitProbe.waitFor(team);

    expect(AfterCommitProbe.seen).toEqual([{ teamId: team, committed: true }]);
  });

  it('repositories join the ambient transaction: txHost.tx inside a unit of work is not the base client', async () => {
    const txHost = app.get(TransactionHost);

    const inside = await app
      .get(ClsService)
      .run(() =>
        txHost.withTransaction(() =>
          Promise.resolve(txHost.isTransactionActive()),
        ),
      );

    expect(inside).toBe(true);
    expect(app.get(ClsService).run(() => txHost.isTransactionActive())).toBe(
      false,
    );
  });
});
