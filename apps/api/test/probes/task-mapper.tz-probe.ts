import { TaskMapper } from '../../src/modules/tasks/infrastructure/task.mapper';
import { CALENDAR_EDGES, activeZone } from './zone';

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: '22222222-2222-4222-8222-222222222222',
  title: 'Ship the login screen',
  description: null,
  status: 'PENDING' as const,
  dueDate: null,
  completedAt: null,
  version: 1,
  createdAt: new Date('2026-10-21T09:00:00.000Z'),
  updatedAt: new Date('2026-10-21T09:00:00.000Z'),
  deletedAt: null,
  teams: [],
};

it('TaskMapper keeps calendar days in the process zone', () => {
  activeZone();
  for (const day of CALENDAR_EDGES) {
    const midnight = new Date(`${day}T00:00:00.000Z`);
    const task = TaskMapper.toDomain({ ...row, dueDate: midnight });

    expect(task.dueDate?.value).toBe(day);
    expect(TaskMapper.toUpdate(task).dueDate).toEqual(midnight);
  }
});
