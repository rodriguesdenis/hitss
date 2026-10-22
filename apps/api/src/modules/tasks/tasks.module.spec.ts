import { CqrsModule, EventBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { TaskMetrics } from './application/ports/task-metrics';
import { TaskCreated } from './domain/task.events';
import { TaskStatus } from './domain/value-objects/task-status';
import { OtelTaskMetrics } from './infrastructure/adapters/otel-task-metrics.adapter';
import { TasksModule } from './tasks.module';

describe('TasksModule', () => {
  it('AC-06.4.2 resolves the metrics port to the OpenTelemetry adapter and its handlers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CqrsModule.forRoot(), TasksModule],
    }).compile();
    await moduleRef.init();

    const metrics = moduleRef.get(TaskMetrics);
    expect(metrics).toBeInstanceOf(OtelTaskMetrics);
    const created = jest.spyOn(metrics, 'taskCreated');

    await moduleRef
      .get(EventBus)
      .publish(
        new TaskCreated('t1', 'u1', TaskStatus.PENDING, new Date('2026-01-01')),
      );
    expect(created).toHaveBeenCalledTimes(1);
  });
});
