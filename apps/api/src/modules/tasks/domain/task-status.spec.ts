import { TaskStatus } from './task-status';

describe('TaskStatus', () => {
  it('AC-03.1.4 has exactly the three contract values', () => {
    expect(Object.values(TaskStatus)).toEqual([
      'PENDING',
      'IN_PROGRESS',
      'DONE',
    ]);
  });
});
