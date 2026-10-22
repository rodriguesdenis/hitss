import { randomUUID } from 'node:crypto';
import { Task } from '../../src/modules/tasks/domain/entities/task.entity';
import {
  TaskNotFound,
  UnknownTeams,
} from '../../src/modules/tasks/domain/errors/task.errors';
import { TaskRepository } from '../../src/modules/tasks/domain/repositories/task.repository';
import { DueDate } from '../../src/modules/tasks/domain/value-objects/due-date.vo';
import { TaskStatus } from '../../src/modules/tasks/domain/value-objects/task-status.vo';
import { TaskTitle } from '../../src/modules/tasks/domain/value-objects/task-title.vo';

export interface TaskRepositoryHarness {
  repository: TaskRepository;
  newOwner(): Promise<string>;
  newTeam(ownerId: string): Promise<string>;
  unknownTeam(): Promise<string>;
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
  const status = extra.status ?? TaskStatus.PENDING;
  const values = {
    ownerId,
    title: TaskTitle.create(extra.title ?? 'Write release notes'),
    description:
      extra.description === undefined ? 'For 1.2' : extra.description,
    dueDate:
      extra.dueDate === null
        ? null
        : DueDate.create(extra.dueDate ?? '2026-10-30'),
    teamIds: extra.teamIds ?? [],
  };
  return extra.id === undefined
    ? Task.create({ ...values, status, now: CREATED })
    : Task.restore({
        ...values,
        id: extra.id,
        status,
        completedAt: status === TaskStatus.DONE ? CREATED : null,
        version: 1,
        createdAt: CREATED,
        updatedAt: CREATED,
        deletedAt: null,
      });
}

function snapshot(task: Task) {
  return {
    id: task.id,
    ownerId: task.ownerId,
    title: task.title.value,
    description: task.description,
    status: task.status,
    dueDate: task.dueDate?.value ?? null,
    teamIds: task.teamIds,
    completedAt: task.completedAt,
    version: task.version,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    deletedAt: task.deletedAt,
  };
}

export function describeTaskRepositoryContract(
  harness: () => TaskRepositoryHarness,
): void {
  const repo = () => harness().repository;
  const owner = () => harness().newOwner();
  const team = (ownerId: string) => harness().newTeam(ownerId);
  const unknownTeam = () => harness().unknownTeam();

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
    });

    it('keeps a task without teams, description or due date', async () => {
      const ownerId = await owner();
      const task = aTask(ownerId, { description: null, dueDate: null });

      await repo().insert(task);
      const loaded = (await repo().findById(ownerId, task.id))!;

      expect(loaded.teamIds).toEqual([]);
      expect(loaded.description).toBeNull();
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
      await repo().update(gone);

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
          description: null,
          dueDate: DueDate.create('2026-11-15'),
          now: LATER,
        });
        loaded.changeStatus(TaskStatus.DONE, LATER);

        await expect(repo().update(loaded)).resolves.toBeUndefined();
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
        loaded.assignTo([b, c], LATER);
        await repo().update(loaded);

        expect((await repo().findById(ownerId, task.id))!.teamIds).toEqual(
          [b, c].sort(),
        );
      });

      it('clears every team link', async () => {
        const ownerId = await owner();
        const a = await team(ownerId);
        const task = aTask(ownerId, { teamIds: [a] });
        await repo().insert(task);

        task.assignTo([], LATER);
        await repo().update(task);

        expect((await repo().findById(ownerId, task.id))!.teamIds).toEqual([]);
      });

      it('AC-08.3 last write wins: an update from an older load still applies and bumps the version', async () => {
        const ownerId = await owner();
        const a = await team(ownerId);
        const task = aTask(ownerId);
        await repo().insert(task);
        task.changeStatus(TaskStatus.IN_PROGRESS, LATER);
        await repo().update(task);

        task.assignTo([a], LATER);
        await repo().update(task);

        const stored = (await repo().findById(ownerId, task.id))!;
        expect(stored.teamIds).toEqual([a]);
        expect(stored.version).toBe(3);
      });

      it('AC-03.12.1 reports a foreign or unknown task as not found and writes nothing', async () => {
        const [ownerId, stranger] = [await owner(), await owner()];
        const task = aTask(ownerId);
        await repo().insert(task);
        const impostor = Task.restore({
          ...propsOf(task),
          ownerId: stranger,
          title: TaskTitle.create('Hijacked'),
        });

        await expect(repo().update(impostor)).rejects.toBeInstanceOf(
          TaskNotFound,
        );
        await expect(repo().update(aTask(ownerId))).rejects.toBeInstanceOf(
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
        await expect(repo().update(task)).resolves.toBeUndefined();
        await expect(repo().findById(ownerId, task.id)).resolves.toBeNull();
        await expect(repo().update(task)).rejects.toBeInstanceOf(TaskNotFound);
      });
    });

    describe('a team that no longer exists (TOCTOU after the directory check)', () => {
      it('insert fails with UnknownTeams and stores nothing', async () => {
        const ownerId = await owner();
        const [live, gone] = [await team(ownerId), await unknownTeam()];
        const task = aTask(ownerId, { teamIds: [live, gone] });

        const error: unknown = await repo()
          .insert(task)
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(UnknownTeams);
        await expect(repo().findById(ownerId, task.id)).resolves.toBeNull();
      });

      it('update fails with UnknownTeams and writes nothing', async () => {
        const ownerId = await owner();
        const live = await team(ownerId);
        const task = aTask(ownerId, { teamIds: [live] });
        await repo().insert(task);
        const gone = await unknownTeam();

        task.changeStatus(TaskStatus.DONE, LATER);
        task.assignTo([live, gone], LATER);
        const error: unknown = await repo()
          .update(task)
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(UnknownTeams);
        const stored = (await repo().findById(ownerId, task.id))!;
        expect(stored.version).toBe(1);
        expect(stored.status).toBe('PENDING');
        expect(stored.teamIds).toEqual([live]);
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
