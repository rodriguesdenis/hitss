import { EventBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { CqrsModule } from '@nestjs/cqrs';
import {
  TaskCreated,
  TaskDeleted,
  TaskStatusChanged,
} from '../../domain/task.events';
import { TaskStatus } from '../../domain/value-objects/task-status';
import { TASK_METRICS, TaskMetrics } from '../ports/task-metrics';
import { TASK_METRICS_HANDLERS } from './record-task-metrics.handler';

const now = new Date('2026-01-01T00:00:00Z');

async function setup() {
  const fns = {
    taskCreated: jest.fn(),
    taskCompleted: jest.fn(),
    taskDeleted: jest.fn(),
  };
  const metrics: TaskMetrics = fns;
  const moduleRef = await Test.createTestingModule({
    imports: [CqrsModule.forRoot()],
    providers: [
      ...TASK_METRICS_HANDLERS,
      { provide: TASK_METRICS, useValue: metrics },
    ],
  }).compile();
  await moduleRef.init();
  return { metrics, fns, bus: moduleRef.get(EventBus) };
}

const counts = (m: {
  taskCreated: jest.Mock;
  taskCompleted: jest.Mock;
  taskDeleted: jest.Mock;
}) => ({
  created: m.taskCreated.mock.calls.length,
  completed: m.taskCompleted.mock.calls.length,
  deleted: m.taskDeleted.mock.calls.length,
});

describe('task metrics event handlers', () => {
  it('AC-06.4.2 a created task increments tasks created once', async () => {
    const { fns: metrics, bus } = await setup();
    await bus.publish(new TaskCreated('t1', 'u1', TaskStatus.PENDING, now));
    expect(counts(metrics)).toEqual({ created: 1, completed: 0, deleted: 0 });
  });

  it('AC-06.4.3 a task created as DONE also counts as completed', async () => {
    const { fns: metrics, bus } = await setup();
    await bus.publish(new TaskCreated('t1', 'u1', TaskStatus.DONE, now));
    expect(counts(metrics)).toEqual({ created: 1, completed: 1, deleted: 0 });
  });

  it.each([
    [TaskStatus.PENDING, TaskStatus.DONE, 1],
    [TaskStatus.IN_PROGRESS, TaskStatus.DONE, 1],
    [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, 0],
    [TaskStatus.DONE, TaskStatus.PENDING, 0],
    [TaskStatus.DONE, TaskStatus.IN_PROGRESS, 0],
  ])(
    'AC-06.4.3 status %s -> %s adds %i to tasks completed',
    async (from, to, expected) => {
      const { fns: metrics, bus } = await setup();
      await bus.publish(new TaskStatusChanged('t1', from, to, now));
      expect(metrics.taskCompleted).toHaveBeenCalledTimes(expected);
      expect(metrics.taskCreated).not.toHaveBeenCalled();
    },
  );

  it('AC-06.4.5 a deleted task increments tasks deleted once', async () => {
    const { fns: metrics, bus } = await setup();
    await bus.publish(new TaskDeleted('t1', now));
    expect(counts(metrics)).toEqual({ created: 0, completed: 0, deleted: 1 });
  });

  it('AC-06.4.2 no event means no count (validation rejection, idempotent replay)', async () => {
    const { fns: metrics } = await setup();
    expect(counts(metrics)).toEqual({ created: 0, completed: 0, deleted: 0 });
  });
});
