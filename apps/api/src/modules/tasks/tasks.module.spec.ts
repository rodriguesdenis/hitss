import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { DomainEventPublisher } from '../../shared/application/ports/domain-event-publisher';
import { UnitOfWork } from '../../shared/application/ports/unit-of-work';
import { DomainErrorMappings } from '../../shared/presentation/filters/domain-error-mappings';
import { CreateTaskHandler } from './application/commands/create-task/create-task.handler';
import { TaskReadModel } from './application/ports/task.read-model';
import { TaskRepository } from './domain/task.repository';
import { TasksModule } from './tasks.module';

/** What AppModule's global modules give TasksModule; the database is not needed here. */
@Global()
@Module({
  providers: [
    { provide: DomainErrorMappings, useValue: { register: jest.fn() } },
    { provide: UnitOfWork, useValue: {} },
    { provide: DomainEventPublisher, useValue: {} },
  ],
  exports: [DomainErrorMappings, UnitOfWork, DomainEventPublisher],
})
class GlobalsStub {}

describe('TasksModule', () => {
  it('compiles with its handlers wired', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CqrsModule.forRoot(), GlobalsStub, TasksModule],
    })
      .overrideProvider(TaskReadModel)
      .useValue({})
      .overrideProvider(TaskRepository)
      .useValue({})
      .compile();
    await moduleRef.init();

    expect(moduleRef.get(CreateTaskHandler)).toBeInstanceOf(CreateTaskHandler);
  });
});
