import {
  TaskStatus,
  type TaskView,
} from '../../../../application/interfaces/task-read-model.interface';
import { TaskPageResponseDto } from '../../../../presentation/dto/task-page-response.dto';
import { TaskResponseDto } from '../../../../presentation/dto/task-response.dto';

const view = (id: string): TaskView => ({
  id,
  title: `Task ${id}`,
  description: null,
  status: TaskStatus.PENDING,
  dueDate: null,
  completedAt: null,
  isOverdue: false,
  teams: [],
  version: 1,
  createdAt: new Date('2026-10-20T13:00:00.000Z'),
  updatedAt: new Date('2026-10-20T13:00:00.000Z'),
});

describe('TaskPageResponseDto.from', () => {
  it('AC-10.8 maps each view and builds the page meta', () => {
    const found = { items: [view('a'), view('b')], total: 5 };

    expect(TaskPageResponseDto.from(found, { limit: 2, offset: 0 })).toEqual({
      data: found.items.map((item) => TaskResponseDto.from(item)),
      meta: { total: 5, limit: 2, offset: 0, hasNextPage: true },
    });
  });

  it('AC-10.8 an empty page has no next page', () => {
    expect(
      TaskPageResponseDto.from(
        { items: [], total: 0 },
        { limit: 20, offset: 0 },
      ),
    ).toEqual({
      data: [],
      meta: { total: 0, limit: 20, offset: 0, hasNextPage: false },
    });
  });
});
