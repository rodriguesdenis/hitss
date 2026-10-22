import { Global, Module } from '@nestjs/common';
import { CqrsModule, EventBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { DomainErrorMappings } from '../../shared/presentation/filters/domain-error-mappings';
import { TaskMetrics } from './application/ports/task-metrics';
import { TaskReadModel } from './application/ports/task.read-model';
import { TaskCreated } from './domain/task.events';
import { TaskStatus } from './domain/value-objects/task-status';
import { OtelTaskMetrics } from './infrastructure/adapters/otel-task-metrics.adapter';
import { TasksModule } from './tasks.module';

/** What AppModule's global modules give TasksModule; the database is not needed here. */
@Global()
@Module({
  providers: [
    { provide: DomainErrorMappings, useValue: { register: jest.fn() } },
  ],
  exports: [DomainErrorMappings],
})
class GlobalsStub {}

describe('TasksModule', () => {
  it('AC-06.4.2 resolves the metrics port to the OpenTelemetry adapter and its handlers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CqrsModule.forRoot(), GlobalsStub, TasksModule],
    })
      .overrideProvider(TaskReadModel)
      .useValue({})
      .compile();
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
