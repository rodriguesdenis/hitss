import { DueDate } from '../value-objects/due-date.vo';
import { isOverdue } from './overdue.policy';
import { TaskStatus } from '../value-objects/task-status.vo';

describe('isOverdue', () => {
  const today = DueDate.create('2026-10-20');

  it.each([
    [TaskStatus.PENDING, '2026-10-19', true],
    [TaskStatus.IN_PROGRESS, '2026-01-01', true],
    [TaskStatus.PENDING, '2026-10-20', false],
    [TaskStatus.PENDING, '2026-10-21', false],
    [TaskStatus.PENDING, null, false],
    [TaskStatus.DONE, '2026-10-19', false],
    [TaskStatus.IN_PROGRESS, '2026-10-20', false],
    [TaskStatus.DONE, null, false],
  ])(
    'AC-03.14.1 AC-03.14.2 %s due %s is overdue: %s',
    (status, due, expected) => {
      const dueDate = due === null ? null : DueDate.create(due);

      expect(isOverdue(status, dueDate, today)).toBe(expected);
    },
  );

  it('BR-03.9 today is the UTC date, not the local date of the instant', () => {
    // 23:30 on the 21st in UTC-3 is already the 22nd in UTC.
    const today = DueDate.todayFrom(new Date('2026-10-21T23:30:00-03:00'));
    expect(today.value).toBe('2026-10-22');

    expect(
      isOverdue(TaskStatus.PENDING, DueDate.create('2026-10-21'), today),
    ).toBe(true);
  });

  it('AC-03.14.3 the passing of a day makes a task overdue without changing it', () => {
    const dueDate = DueDate.create('2026-10-21');

    expect(
      isOverdue(TaskStatus.PENDING, dueDate, DueDate.create('2026-10-21')),
    ).toBe(false);
    expect(
      isOverdue(
        TaskStatus.PENDING,
        dueDate,
        DueDate.todayFrom(new Date('2026-10-22T00:00:01Z')),
      ),
    ).toBe(true);
  });
});
