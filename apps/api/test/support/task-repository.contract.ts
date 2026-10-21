import { randomUUID } from 'node:crypto';
import { ConcurrencyConflict } from '../../src/shared/domain/domain-error';
import { Task } from '../../src/modules/tasks/domain/task';
import { TaskNotFound } from '../../src/modules/tasks/domain/task.errors';
import { TaskRepository } from '../../src/modules/tasks/domain/task.repository';
import { DueDate } from '../../src/modules/tasks/domain/value-objects/due-date';
import { TaskDescription } from '../../src/modules/tasks/domain/value-objects/task-description';
import { TaskStatus } from '../../src/modules/tasks/domain/value-objects/task-status';
import { TaskTeamIds } from '../../src/modules/tasks/domain/value-objects/task-team-ids';
import { TaskTitle } from '../../src/modules/tasks/domain/value-objects/task-title';

export interface TaskRepositoryHarness {
  repository: TaskRepository;
  /** An owner id the repository accepts (the Prisma adapter needs an existing user). */
  newOwner(): Promise<string>;
  /** A team of that owner (the Prisma adapter needs an existing team for the links). */
  newTeam(ownerId: string): Promise<string>;
}

const CREATED = new Date('2026-10-21T09:00:00.000Z');
const LATER = new Date('2026-10-21T10:00:00.000Z');

export function aTask(
  ownerId: string,
  extra: {
    id?: string;
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    dueDate?: string | null;
    teamIds?: string[];
  } = {},
): Task {
  return Task.create({
    id: extra.id ?? randomUUID(),
    ownerId,
    title: TaskTitle.create(extra.title ?? 'Write release notes'),
    description: TaskDescription.create(
      extra.description === undefined ? 'For 1.2' : extra.description,
    ),
    status: extra.status,
    dueDate:
      extra.dueDate === null
        ? null
        : DueDate.create(extra.dueDate ?? '2026-10-30'),
    teamIds: TaskTeamIds.of(extra.teamIds ?? []),
    now: CREATED,
  });
}

function snapshot(task: Task) {
  return {
    id: task.id,
    ownerId: task.ownerId,
    title: task.title.value,
    description: task.description.value,
    status: task.status,
    dueDate: task.dueDate?.value ?? null,
    teamIds: task.teamIds.values,
    completedAt: task.completedAt,
    version: task.version,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    deletedAt: task.deletedAt,
  };
}

/**
 * Behaviour every TaskRepository must show (T-003-04). Run against the in-memory fake (unit)
 * and the Prisma adapter (integration). `harness` is read inside tests, after beforeAll hooks.
 */
export function describeTaskRepositoryContract(
  harness: () => TaskRepositoryHarness,
): void {
  const repo = () => harness().repository;
  const owner = () => harness().newOwner();
  const team = (ownerId: string) => harness().newTeam(ownerId);

  describe('TaskRepository contract', () => {
    it('stores a new task with its teams at version 1 and loads every field back', async () => {
      const ownerId = await owner();
      const teams = [await team(ownerId), await team(ownerId)];
      const task = aTask(ownerId, { status: TaskStatus.DONE, teamIds: teams });

      await repo().insert(task);
      const loaded = await repo().findById(ownerId, task.id);

      expect(loaded).not.toBeNull();
      expect(loaded).not.toBe(task);
      expect(snapshot(loaded!)).toEqual({
        id: task.id,
        ownerId,
        title: 'Write release notes',
        description: 'For 1.2',
        status: 'DONE',
        dueDate: '2026-10-30',
        teamIds: [...teams].sort(),
        completedAt: CREATED,
        version: 1,
        createdAt: CREATED,
        updatedAt: CREATED,
        deletedAt: null,
      });
      expect(loaded!.pullEvents()).toEqual([]);
    });

    it('keeps a task without teams, description or due date', async () => {
      const ownerId = await owner();
      const task = aTask(ownerId, { description: null, dueDate: null });

      await repo().insert(task);
      const loaded = (await repo().findById(ownerId, task.id))!;

      expect(loaded.teamIds.values).toEqual([]);
      expect(loaded.description.value).toBeNull();
      expect(loaded.dueDate).toBeNull();
      expect(loaded.completedAt).toBeNull();
    });

    it('AC-03.12.1 AC-03.11.1 returns null for a foreign, unknown, malformed or deleted id', async () => {
      const [ownerId, stranger] = [await owner(), await owner()];
      const task = aTask(ownerId);
      await repo().insert(task);
      const gone = aTask(ownerId);
      await repo().insert(gone);
      gone.delete(LATER);
      await repo().update(gone, 1);

      await expect(repo().findById(stranger, task.id)).resolves.toBeNull();
      await expect(repo().findById(ownerId, randomUUID())).resolves.toBeNull();
      await expect(repo().findById(ownerId, 'not-a-uuid')).resolves.toBeNull();
      await expect(repo().findById(ownerId, gone.id)).resolves.toBeNull();
    });

    it('returns a fresh copy: changing it without update leaves the store as it was', async () => {
      const ownerId = await owner();
      const task = aTask(ownerId);
      await repo().insert(task);

      (await repo().findById(ownerId, task.id))!.changeStatus(
        TaskStatus.DONE,
        LATER,
      );

      const again = (await repo().findById(ownerId, task.id))!;
      expect(again.status).toBe('PENDING');
      expect(again.updatedAt).toEqual(CREATED);
    });

    describe('update', () => {
      it('writes every changed field and returns the incremented version', async () => {
        const ownerId = await owner();
        const task = aTask(ownerId);
        await repo().insert(task);

        const loaded = (await repo().findById(ownerId, task.id))!;
        loaded.edit({
          title: TaskTitle.create('Publish release notes'),
          description: TaskDescription.create(null),
          dueDate: DueDate.create('2026-11-15'),
          now: LATER,
        });
        loaded.changeStatus(TaskStatus.DONE, LATER);

        await expect(repo().update(loaded, 1)).resolves.toBe(2);
        expect(snapshot((await repo().findById(ownerId, task.id))!)).toEqual({
          ...snapshot(loaded),
          version: 2,
        });
      });

      it('AC-03.9.2 replaces the team set (removed links deleted, new ones added)', async () => {
        const ownerId = await owner();
        const [a, b, c] = [
          await team(ownerId),
          await team(ownerId),
          await team(ownerId),
        ];
        const task = aTask(ownerId, { teamIds: [a, b] });
        await repo().insert(task);

        const loaded = (await repo().findById(ownerId, task.id))!;
        loaded.assignTo(TaskTeamIds.of([b, c]), LATER);
        await repo().update(loaded, 1);

        expect(
          (await repo().findById(ownerId, task.id))!.teamIds.values,
        ).toEqual([b, c].sort());
        await expect(repo().findByTeam(ownerId, a)).resolves.toEqual([]);
      });

      it('clears every team link', async () => {
        const ownerId = await owner();
        const a = await team(ownerId);
        const task = aTask(ownerId, { teamIds: [a] });
        await repo().insert(task);

        task.assignTo(TaskTeamIds.of([]), LATER);
        await repo().update(task, 1);

        expect(
          (await repo().findById(ownerId, task.id))!.teamIds.values,
        ).toEqual([]);
      });

      it('BR-03.12 rejects a stale expected version with the current one and writes nothing', async () => {
        const ownerId = await owner();
        const a = await team(ownerId);
        const task = aTask(ownerId);
        await repo().insert(task);
        task.changeStatus(TaskStatus.IN_PROGRESS, LATER);
        await repo().update(task, 1);

        task.assignTo(TaskTeamIds.of([a]), LATER);
        const error: unknown = await repo()
          .update(task, 1)
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ConcurrencyConflict);
        expect((error as ConcurrencyConflict).currentVersion).toBe(2);
        expect(
          (await repo().findById(ownerId, task.id))!.teamIds.values,
        ).toEqual([]);
      });

      it('AC-03.12.1 reports a foreign or unknown task as not found and writes nothing', async () => {
        const [ownerId, stranger] = [await owner(), await owner()];
        const task = aTask(ownerId);
        await repo().insert(task);
        const impostor = Task.reconstitute({
          ...propsOf(task),
          ownerId: stranger,
          title: TaskTitle.create('Hijacked'),
        });

        await expect(repo().update(impostor, 1)).rejects.toBeInstanceOf(
          TaskNotFound,
        );
        await expect(repo().update(aTask(ownerId), 1)).rejects.toBeInstanceOf(
          TaskNotFound,
        );
        expect((await repo().findById(ownerId, task.id))!.title.value).toBe(
          'Write release notes',
        );
      });

      it('AC-03.11.1 soft-deletes through update; a second delete is not found', async () => {
        const ownerId = await owner();
        const a = await team(ownerId);
        const task = aTask(ownerId, { teamIds: [a] });
        await repo().insert(task);

        task.delete(LATER);
        await expect(repo().update(task, 1)).resolves.toBe(2);
        await expect(repo().findById(ownerId, task.id)).resolves.toBeNull();
        await expect(repo().findByTeam(ownerId, a)).resolves.toEqual([]);
        await expect(repo().update(task, 2)).rejects.toBeInstanceOf(
          TaskNotFound,
        );
      });
    });

    describe('findByTeam', () => {
      it('returns only the owner’s active tasks of that team, ordered by id', async () => {
        const [ownerId, stranger] = [await owner(), await owner()];
        const [a, b] = [await team(ownerId), await team(ownerId)];
        const ids = [randomUUID(), randomUUID(), randomUUID()];
        await repo().insert(aTask(ownerId, { id: ids[0], teamIds: [a] }));
        await repo().insert(aTask(ownerId, { id: ids[1], teamIds: [a, b] }));
        await repo().insert(aTask(ownerId, { id: ids[2], teamIds: [b] }));
        const gone = aTask(ownerId, { teamIds: [a] });
        await repo().insert(gone);
        gone.delete(LATER);
        await repo().update(gone, 1);

        const found = await repo().findByTeam(ownerId, a);

        expect(found.map((t) => t.id)).toEqual([ids[0]!, ids[1]!].sort());
        expect(found.find((t) => t.id === ids[1])!.teamIds.values).toEqual(
          [a, b].sort(),
        );
        await expect(repo().findByTeam(stranger, a)).resolves.toEqual([]);
      });
    });
  });
}

function propsOf(task: Task) {
  return {
    id: task.id,
    ownerId: task.ownerId,
    title: task.title,
    description: task.description,
    status: task.status,
    dueDate: task.dueDate,
    teamIds: task.teamIds,
    completedAt: task.completedAt,
    version: task.version,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    deletedAt: task.deletedAt,
  };
}
