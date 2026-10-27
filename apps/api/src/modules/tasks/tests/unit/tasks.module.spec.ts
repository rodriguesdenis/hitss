import { Test } from '@nestjs/testing';
import { TeamLookup } from '../../../teams/application/team-lookup.service';
import { TeamReadModel } from '../../../teams/application/interfaces/team-read-model.interface';
import { TeamRepository } from '../../../teams/domain/repositories/team.repository';
import { TeamDirectory } from '../../application/interfaces/team-directory.interface';
import { TaskReadModel } from '../../application/interfaces/task-read-model.interface';
import { CreateTaskUseCase } from '../../application/use-cases/create-task.use-case';
import { TaskRepository } from '../../domain/repositories/task.repository';
import { TasksModule } from '../../tasks.module';

describe('TasksModule', () => {
  it('compiles with its use cases wired and TeamLookup injected from TeamsModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TasksModule],
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

  it('AC-09.7 resolves TeamDirectory to the TeamLookup exported by TeamsModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TasksModule],
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

    const directory = moduleRef.get(TeamDirectory);
    expect(directory).toBeInstanceOf(TeamLookup);
    expect(directory).toBe(moduleRef.get(TeamLookup, { strict: false }));
    expect(moduleRef.get<{ teams: unknown }>(CreateTaskUseCase).teams).toBe(
      directory,
    );
  });
});
