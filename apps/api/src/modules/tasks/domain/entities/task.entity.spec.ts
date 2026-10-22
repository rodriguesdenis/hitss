import { DueDate } from '../value-objects/due-date.vo';
import { isOverdue } from '../policies/overdue.policy';
import { Task, TaskProps } from './task.entity';
import { TaskDescription } from '../value-objects/task-description.vo';
import { TaskStatus } from '../value-objects/task-status.vo';
import { TaskTeamIds } from '../value-objects/task-team-ids.vo';
import { TaskTitle } from '../value-objects/task-title.vo';

// ISO strings, not shared Date instances, so aliasing bugs cannot hide.
const CREATED = '2026-10-20T13:00:00.000Z';
const COMPLETED = '2026-10-19T08:00:00.000Z';
const NOW = '2026-10-21T09:00:00.000Z';
const TASK_ID = '0d8f6a52-6c1e-4b8a-9f3e-5a7c2e1d4b90';
const OWNER_ID = 'owner-1';
const { PENDING, IN_PROGRESS, DONE } = TaskStatus;

function created(status?: TaskStatus): Task {
  return Task.create({
    ownerId: OWNER_ID,
    title: TaskTitle.create('Write release notes'),
    description: TaskDescription.create(null),
    status,
    dueDate: null,
    teamIds: TaskTeamIds.of([]),
    now: new Date(CREATED),
  });
}

/** "Ship it": version 3, notes, due 2026-10-31, assigned to Mobile and Backend. */
function stored(overrides: Partial<TaskProps> = {}): Task {
  return Task.restore({
    id: TASK_ID,
    ownerId: OWNER_ID,
    title: TaskTitle.create('Ship it'),
    description: TaskDescription.create('notes'),
    status: PENDING,
    dueDate: DueDate.create('2026-10-31'),
    teamIds: TaskTeamIds.of(['mobile', 'backend']),
    completedAt: null,
    version: 3,
    createdAt: new Date(CREATED),
    updatedAt: new Date(CREATED),
    deletedAt: null,
    ...overrides,
  });
}

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

describe('Task', () => {
  describe('create', () => {
    it('AC-03.1.1 defaults: pending, nothing optional set, version 1, created = updated = now', () => {
      const task = created();

      expect(task.ownerId).toBe(OWNER_ID);
      expect(task.title.value).toBe('Write release notes');
      expect(task.description.value).toBeNull();
      expect(task.status).toBe(PENDING);
      expect(task.dueDate).toBeNull();
      expect(task.teamIds.values).toEqual([]);
      expect(task.completedAt).toBeNull();
      expect(task.version).toBe(1);
      expect(iso(task.createdAt)).toBe(CREATED);
      expect(iso(task.updatedAt)).toBe(CREATED);
      expect(task.deletedAt).toBeNull();
      expect(task.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(created().id).not.toBe(task.id);
    });

    it.each([
      [PENDING, null],
      [IN_PROGRESS, null],
      [DONE, CREATED],
    ])(
      'AC-03.1.4 created as %s has completion time %s',
      (status, completedAt) => {
        const task = created(status);

        expect(task.status).toBe(status);
        expect(iso(task.completedAt)).toBe(completedAt);
      },
    );
  });

  it('restore rebuilds a persisted task', () => {
    const task = stored({ status: DONE, completedAt: new Date(COMPLETED) });

    expect(task.title.value).toBe('Ship it');
    expect(task.description.value).toBe('notes');
    expect(task.dueDate?.value).toBe('2026-10-31');
    expect(task.teamIds.values).toEqual(['backend', 'mobile']);
    expect(iso(task.completedAt)).toBe(COMPLETED);
    expect(task.version).toBe(3);
  });

  describe('AC-03.10.1 AC-03.10.2 AC-03.10.3 AC-03.9.4 changeStatus transition matrix', () => {
    // `changed` true ⇔ persistence writes version n+1; false ⇔ version stays n.
    it.each([
      [PENDING, PENDING, false, null],
      [PENDING, IN_PROGRESS, true, null],
      [PENDING, DONE, true, NOW],
      [IN_PROGRESS, PENDING, true, null],
      [IN_PROGRESS, IN_PROGRESS, false, null],
      [IN_PROGRESS, DONE, true, NOW],
      [DONE, PENDING, true, null],
      [DONE, IN_PROGRESS, true, null],
      [DONE, DONE, false, COMPLETED],
    ] as const)(
      '%s → %s: changed %s, completed at %s',
      (from, to, changed, completedAt) => {
        const task = stored({
          status: from,
          completedAt: from === DONE ? new Date(COMPLETED) : null,
        });

        expect(task.changeStatus(to, new Date(NOW))).toBe(changed);
        expect(task.status).toBe(to);
        expect(iso(task.completedAt)).toBe(completedAt);
        expect(task.version).toBe(3);
        expect(iso(task.updatedAt)).toBe(changed ? NOW : CREATED);
      },
    );

    it('AC-03.10.5 a status change touches nothing else', () => {
      const task = stored();

      task.changeStatus(DONE, new Date(NOW));

      expect(task.title.value).toBe('Ship it');
      expect(task.description.value).toBe('notes');
      expect(task.dueDate?.value).toBe('2026-10-31');
      expect(task.teamIds.values).toEqual(['backend', 'mobile']);
    });
  });

  describe('edit (title, description, due date)', () => {
    it('AC-03.9.5 identical values after normalization change nothing', () => {
      const task = stored();

      const changed = task.edit({
        title: TaskTitle.create('  Ship it  '),
        description: TaskDescription.create(' notes '),
        dueDate: DueDate.create('2026-10-31'),
        now: new Date(NOW),
      });

      expect(changed).toBe(false);
      expect(iso(task.updatedAt)).toBe(CREATED);
    });

    it('AC-03.9.5 no due date before and after is not a change', () => {
      const task = stored({ dueDate: null });

      const changed = task.edit({
        title: task.title,
        description: task.description,
        dueDate: null,
        now: new Date(NOW),
      });

      expect(changed).toBe(false);
      expect(iso(task.updatedAt)).toBe(CREATED);
    });

    type EditRow = [string, Partial<TaskProps>, Partial<TaskProps>];
    it.each<EditRow>([
      ['the title', {}, { title: TaskTitle.create('Ship it now') }],
      ['the description', {}, { description: TaskDescription.create('more') }],
      [
        'clearing the description',
        {},
        { description: TaskDescription.create('') },
      ],
      ['the due date', {}, { dueDate: DueDate.create('2026-11-01') }],
      ['clearing the due date', {}, { dueDate: null }],
      [
        'setting a due date',
        { dueDate: null },
        { dueDate: DueDate.create('2026-12-24') },
      ],
    ])('changing %s is a change', (_label, start, next) => {
      const task = stored(start);
      const values = {
        title: next.title ?? task.title,
        description: next.description ?? task.description,
        dueDate: 'dueDate' in next ? (next.dueDate ?? null) : task.dueDate,
      };

      expect(task.edit({ ...values, now: new Date(NOW) })).toBe(true);
      expect(task.title.equals(values.title)).toBe(true);
      expect(task.description.equals(values.description)).toBe(true);
      expect(task.dueDate?.value ?? null).toBe(values.dueDate?.value ?? null);
      expect(iso(task.updatedAt)).toBe(NOW);
      expect(task.version).toBe(3);
      expect(task.status).toBe(PENDING);
    });
  });

  describe('assignTo (replaces the whole set)', () => {
    it('AC-03.9.5 the same teams in another order change nothing', () => {
      const task = stored();

      expect(
        task.assignTo(TaskTeamIds.of(['backend', 'mobile']), new Date(NOW)),
      ).toBe(false);
      expect(iso(task.updatedAt)).toBe(CREATED);
    });

    it('another set is a change', () => {
      const task = stored();

      expect(task.assignTo(TaskTeamIds.of(['design']), new Date(NOW))).toBe(
        true,
      );
      expect(task.teamIds.values).toEqual(['design']);
      expect(iso(task.updatedAt)).toBe(NOW);
      expect(task.version).toBe(3);
    });
  });

  describe('delete', () => {
    it('archives the task', () => {
      const task = stored();

      task.delete(new Date(NOW));

      expect(iso(task.deletedAt)).toBe(NOW);
    });

    it('deleting twice is a no-op', () => {
      const task = stored();
      task.delete(new Date(NOW));

      task.delete(new Date('2026-10-22T00:00:00.000Z'));

      expect(iso(task.deletedAt)).toBe(NOW);
    });
  });

  it('AC-03.14.3 reopening a late Done task makes it overdue', () => {
    const task = stored({
      status: DONE,
      completedAt: new Date(COMPLETED),
      dueDate: DueDate.create('2026-10-01'),
    });
    const today = DueDate.create('2026-10-20');
    expect(isOverdue(task.status, task.dueDate, today)).toBe(false);

    task.changeStatus(IN_PROGRESS, new Date(NOW));

    expect(isOverdue(task.status, task.dueDate, today)).toBe(true);
  });

  describe('timestamps are not shared with callers', () => {
    it('getters return copies', () => {
      const task = stored({ status: DONE, completedAt: new Date(COMPLETED) });
      task.delete(new Date(NOW));

      for (const date of [
        task.createdAt,
        task.updatedAt,
        task.completedAt,
        task.deletedAt,
      ]) {
        date?.setUTCFullYear(2000);
      }

      expect(iso(task.createdAt)).toBe(CREATED);
      expect(iso(task.updatedAt)).toBe(CREATED);
      expect(iso(task.completedAt)).toBe(COMPLETED);
      expect(iso(task.deletedAt)).toBe(NOW);
    });

    it('inputs are copied', () => {
      const createdAt = new Date(CREATED);
      const task = Task.create({
        ownerId: OWNER_ID,
        title: TaskTitle.create('Ship it'),
        description: TaskDescription.create(null),
        status: DONE,
        dueDate: null,
        teamIds: TaskTeamIds.of([]),
        now: createdAt,
      });
      const reopenedAt = new Date(NOW);
      task.changeStatus(PENDING, reopenedAt);
      const completedAt = new Date(NOW);
      task.changeStatus(DONE, completedAt);
      const deletedAt = new Date(NOW);
      task.delete(deletedAt);

      for (const date of [createdAt, reopenedAt, completedAt, deletedAt]) {
        date.setUTCFullYear(2000);
      }

      expect(iso(task.createdAt)).toBe(CREATED);
      expect(iso(task.updatedAt)).toBe(NOW);
      expect(iso(task.completedAt)).toBe(NOW);
      expect(iso(task.deletedAt)).toBe(NOW);
    });

    it('restored dates are copied', () => {
      const props = {
        createdAt: new Date(CREATED),
        updatedAt: new Date(CREATED),
        completedAt: new Date(COMPLETED),
        deletedAt: new Date(NOW),
      };
      const task = stored({ status: DONE, ...props });

      for (const date of Object.values(props)) {
        date.setUTCFullYear(2000);
      }

      expect(iso(task.createdAt)).toBe(CREATED);
      expect(iso(task.updatedAt)).toBe(CREATED);
      expect(iso(task.completedAt)).toBe(COMPLETED);
      expect(iso(task.deletedAt)).toBe(NOW);
    });
  });
});
