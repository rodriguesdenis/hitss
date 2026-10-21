import { DueDate } from './due-date';
import { isOverdue } from './overdue.policy';
import { TaskStatus } from './task-status';

describe('isOverdue', () => {
  const today = DueDate.create('2026-10-20');

  it.each([
    [TaskStatus.PENDING, '2026-10-19', true],
    [TaskStatus.IN_PROGRESS, '2026-01-01', true],
    [TaskStatus.PENDING, '2026-10-20', false],
    [TaskStatus.PENDING, '2026-10-21', false],
    [TaskStatus.PENDING, null, false],
    [TaskStatus.DONE, '2026-10-19', false],
  ])(
    'AC-03.14.1 AC-03.14.2 %s due %s is overdue: %s',
    (status, due, expected) => {
      const dueDate = due === null ? null : DueDate.create(due);

      expect(isOverdue(status, dueDate, today)).toBe(expected);
    },
  );

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
