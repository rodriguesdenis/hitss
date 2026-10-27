import type { TaskRecord } from '../../../../application/interfaces/task-read-model.interface';
import type { TeamSummary } from '../../../../application/interfaces/team-directory.interface';
import { toTaskView } from '../../../../application/use-cases/task-view';
import { DueDate } from '../../../../domain/value-objects/due-date.vo';
import { TaskStatus } from '../../../../domain/value-objects/task-status.vo';

const TODAY = DueDate.create('2026-10-21');
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const record: TaskRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Implement login screen',
  description: 'Email + password',
  status: TaskStatus.IN_PROGRESS,
  dueDate: '2026-10-31',
  completedAt: null,
  teamIds: [A, B, C],
  version: 3,
  createdAt: new Date('2026-10-20T13:00:00.000Z'),
  updatedAt: new Date('2026-10-21T09:12:00.000Z'),
};

const team = (id: string, name: string): TeamSummary => ({
  id,
  name,
  colorHex: '#7C3AED',
});

describe('toTaskView', () => {
  it('AC-03.8.1 carries the record fields without teamIds, and only the summary fields of each team', () => {
    const view = toTaskView(
      { ...record, teamIds: [A] },
      [{ ...team(A, 'Mobile'), extra: 'dropped' } as TeamSummary],
      TODAY,
    );

    expect(view).toEqual({
      id: record.id,
      title: record.title,
      description: record.description,
      status: record.status,
      dueDate: record.dueDate,
      completedAt: null,
      isOverdue: false,
      teams: [team(A, 'Mobile')],
      version: 3,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  });

  it('AC-03.2.5 orders teams by name case-insensitively, ties by id', () => {
    const view = toTaskView(
      record,
      [team(C, 'backend'), team(A, 'Mobile'), team(B, 'Backend')],
      TODAY,
    );

    expect(view.teams.map((t) => [t.name, t.id])).toEqual([
      ['Backend', B],
      ['backend', C],
      ['Mobile', A],
    ]);
  });

  it('AC-03.2.5 never embeds a team the directory did not return (deleted) or the task does not have', () => {
    const view = toTaskView(
      { ...record, teamIds: [A, B] },
      [team(A, 'Mobile'), team(D, 'Not on this task')],
      TODAY,
    );

    expect(view.teams.map((t) => t.id)).toEqual([A]);
  });

  describe('AC-03.14.1 AC-03.14.2 isOverdue (today = 2026-10-21 UTC)', () => {
    it.each([
      ['PENDING, due yesterday', TaskStatus.PENDING, '2026-10-20', true],
      ['IN_PROGRESS, due long ago', TaskStatus.IN_PROGRESS, '2025-01-01', true],
      ['PENDING, due today', TaskStatus.PENDING, '2026-10-21', false],
      ['PENDING, due tomorrow', TaskStatus.PENDING, '2026-10-22', false],
      ['PENDING, no due date', TaskStatus.PENDING, null, false],
      ['DONE, due yesterday', TaskStatus.DONE, '2026-10-20', false],
    ])('%s → %s', (_label, status, dueDate, overdue) => {
      const view = toTaskView(
        {
          ...record,
          status,
          dueDate,
          completedAt: status === TaskStatus.DONE ? new Date() : null,
        },
        [],
        TODAY,
      );

      expect(view.isOverdue).toBe(overdue);
    });
  });
});
