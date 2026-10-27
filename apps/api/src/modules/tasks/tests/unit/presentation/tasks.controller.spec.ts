import type { ServerResponse } from 'node:http';
import type { ChangeTaskStatusUseCase } from '../../../application/use-cases/change-task-status.use-case';
import type { CreateTaskUseCase } from '../../../application/use-cases/create-task.use-case';
import type { DeleteTaskUseCase } from '../../../application/use-cases/delete-task.use-case';
import type { GetTaskUseCase } from '../../../application/use-cases/get-task.use-case';
import type { ListTasksUseCase } from '../../../application/use-cases/list-tasks.use-case';
import type { UpdateTaskUseCase } from '../../../application/use-cases/update-task.use-case';
import {
  TaskStatus,
  type TaskView,
} from '../../../application/interfaces/task-read-model.interface';
import { TaskResponseDto } from '../../../presentation/dto/task-response.dto';
import { TasksController } from '../../../presentation/tasks.controller';

const OWNER = { ownerId: 'owner-1' };
const ID = '11111111-1111-4111-8111-111111111111';
const VIEW: TaskView = {
  id: ID,
  title: 'Ship it',
  description: null,
  status: TaskStatus.PENDING,
  dueDate: null,
  completedAt: null,
  isOverdue: false,
  teams: [],
  version: 1,
  createdAt: new Date('2026-10-20T13:00:00.000Z'),
  updatedAt: new Date('2026-10-20T13:00:00.000Z'),
};

describe('TasksController', () => {
  const write = () => jest.fn().mockResolvedValue(VIEW);
  const useCases = {
    create: write(),
    update: write(),
    changeStatus: write(),
    get: jest.fn(),
  };
  const controller = new TasksController(
    { execute: useCases.create } as unknown as CreateTaskUseCase,
    { execute: useCases.update } as unknown as UpdateTaskUseCase,
    { execute: useCases.changeStatus } as unknown as ChangeTaskStatusUseCase,
    { execute: jest.fn() } as unknown as DeleteTaskUseCase,
    { execute: useCases.get } as unknown as GetTaskUseCase,
    { execute: jest.fn() } as unknown as ListTasksUseCase,
  );

  afterEach(() => useCases.get.mockClear());

  it('AC-10.6 create maps the view the use case returns and sets Location', async () => {
    const response = { setHeader: jest.fn() };

    const body = await controller.create(
      OWNER,
      { title: 'Ship it' },
      response as unknown as ServerResponse,
    );

    expect(useCases.create).toHaveBeenCalledWith({
      title: 'Ship it',
      ownerId: 'owner-1',
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      'Location',
      `/api/v1/tasks/${ID}`,
    );
    expect(body).toEqual(TaskResponseDto.from(VIEW));
    expect(useCases.get).not.toHaveBeenCalled();
  });

  it('AC-10.6 replace and change status map the view without reading it again', async () => {
    const replaced = await controller.replace(
      OWNER,
      { id: ID },
      { title: 'Ship it', status: TaskStatus.DONE, teamIds: [] },
    );
    const changed = await controller.changeStatus(
      OWNER,
      { id: ID },
      { status: TaskStatus.DONE },
    );

    expect(useCases.update).toHaveBeenCalledWith({
      title: 'Ship it',
      status: TaskStatus.DONE,
      teamIds: [],
      ownerId: 'owner-1',
      id: ID,
    });
    expect(useCases.changeStatus).toHaveBeenCalledWith({
      status: TaskStatus.DONE,
      ownerId: 'owner-1',
      id: ID,
    });
    expect([replaced, changed]).toEqual([
      TaskResponseDto.from(VIEW),
      TaskResponseDto.from(VIEW),
    ]);
    expect(useCases.get).not.toHaveBeenCalled();
  });
});
