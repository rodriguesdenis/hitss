import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DomainErrorMappings } from '../../../../shared/presentation/filters/domain-error-mappings';
import { TeamLookup } from '../../../teams/team-lookup.service';
import { TeamReadModel } from '../../../teams/application/ports/team.read-model';
import { TeamRepository } from '../../../teams/domain/repositories/team.repository';
import { TaskReadModel } from '../../application/ports/task.read-model';
import { CreateTaskUseCase } from '../../application/use-cases/create-task.use-case';
import { TaskRepository } from '../../domain/repositories/task.repository';
import { TasksModule } from '../../tasks.module';

@Global()
@Module({
  providers: [
    { provide: DomainErrorMappings, useValue: { register: jest.fn() } },
  ],
  exports: [DomainErrorMappings],
})
class GlobalsStub {}

describe('TasksModule', () => {
  it('compiles with its use cases wired and TeamLookup injected from TeamsModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GlobalsStub, TasksModule],
    })
      .overrideProvider(TaskReadModel)
      .useValue({})
      .overrideProvider(TaskRepository)
      .useValue({})
      .overrideProvider(TeamReadModel)
      .useValue({})
      .overrideProvider(TeamRepository)
      .useValue({})
      .compile();
    await moduleRef.init();

    expect(moduleRef.get(CreateTaskUseCase)).toBeInstanceOf(CreateTaskUseCase);
    expect(moduleRef.get(TeamLookup, { strict: false })).toBeInstanceOf(
      TeamLookup,
    );
  });
});
