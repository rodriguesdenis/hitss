import {
  TaskStatus,
  type TaskView,
} from '../../../../../application/interfaces/task-read-model.interface';
import type { TeamSummary } from '../../../../../application/interfaces/team-directory.interface';
import { TaskResponseDto } from '../../../../../presentation/http/dto/task-response.dto';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const view: TaskView = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Implement login screen',
  description: 'Email + password',
  status: TaskStatus.DONE,
  dueDate: '2026-10-31',
  completedAt: new Date('2026-10-21T10:00:00.000Z'),
  isOverdue: false,
  teams: [
    {
      id: A,
      name: 'Mobile',
      colorHex: '#7C3AED',
      extra: 'dropped',
    } as TeamSummary,
  ],
  version: 3,
  createdAt: new Date('2026-10-20T13:00:00.000Z'),
  updatedAt: new Date('2026-10-21T09:12:00.000Z'),
};

describe('TaskResponseDto.from', () => {
  it('AC-03.8.1 AC-09.4 keeps only the contract fields, with ISO timestamps', () => {
    expect(TaskResponseDto.from(view)).toEqual({
      id: view.id,
      title: 'Implement login screen',
      description: 'Email + password',
      status: 'DONE',
      dueDate: '2026-10-31',
      completedAt: '2026-10-21T10:00:00.000Z',
      isOverdue: false,
      teams: [{ id: A, name: 'Mobile', colorHex: '#7C3AED' }],
      version: 3,
      createdAt: '2026-10-20T13:00:00.000Z',
      updatedAt: '2026-10-21T09:12:00.000Z',
    });
  });

  it('keeps the order and the overdue flag the use case computed', () => {
    const response = TaskResponseDto.from({
      ...view,
      status: TaskStatus.PENDING,
      completedAt: null,
      isOverdue: true,
      teams: [
        { id: 'b', name: 'Zeta', colorHex: '#000000' },
        { id: 'a', name: 'Alpha', colorHex: '#000000' },
      ],
    });

    expect(response.completedAt).toBeNull();
    expect(response.isOverdue).toBe(true);
    expect(response.teams.map((t) => t.name)).toEqual(['Zeta', 'Alpha']);
  });
});
