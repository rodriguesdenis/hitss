import { TaskStatus } from '../domain/value-objects/task-status';
import { toTaskResponse } from './task.presenter';

describe('toTaskResponse', () => {
  it('AC-03.8.1 keeps only the contract fields, with ISO timestamps', () => {
    const team = { id: 't1', name: 'Mobile', colorHex: '#7C3AED' };
    const response = toTaskResponse({
      id: 'task-1',
      title: 'Ship',
      description: null,
      status: TaskStatus.DONE,
      dueDate: '2026-10-31',
      completedAt: new Date('2026-10-21T10:00:00.000Z'),
      isOverdue: false,
      teams: [{ ...team, extra: 'dropped' } as typeof team],
      version: 2,
      createdAt: new Date('2026-10-20T13:00:00.000Z'),
      updatedAt: new Date('2026-10-21T10:00:00.000Z'),
    });

    expect(response).toEqual({
      id: 'task-1',
      title: 'Ship',
      description: null,
      status: 'DONE',
      dueDate: '2026-10-31',
      completedAt: '2026-10-21T10:00:00.000Z',
      isOverdue: false,
      teams: [team],
      version: 2,
      createdAt: '2026-10-20T13:00:00.000Z',
      updatedAt: '2026-10-21T10:00:00.000Z',
    });
  });
});
