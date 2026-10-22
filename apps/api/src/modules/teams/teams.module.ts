import { Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { Clock } from '../../shared/application/ports/clock';
import { IdGenerator } from '../../shared/application/ports/id-generator';
import { SystemClock } from '../../shared/infrastructure/system-clock';
import { UuidGenerator } from '../../shared/infrastructure/uuid-generator';
import { DomainErrorMappings } from '../../shared/presentation/filters/domain-error-mappings';
import { CreateTeamHandler } from './application/commands/create-team/create-team.handler';
import { TeamReadModel } from './application/ports/team.read-model';
import { TeamTaskCounts } from './application/ports/team-task-counts';
import { GetTeamHandler } from './application/queries/get-team/get-team.handler';
import { TeamRepository } from './domain/team.repository';
import { ZeroTeamTaskCounts } from './infrastructure/adapters/team-task-counts.adapter';
import { PrismaTeamReadModel } from './infrastructure/prisma-team.read-model';
import { PrismaTeamRepository } from './infrastructure/prisma-team.repository';
import { TeamsController } from './presentation/teams.controller';
import { TEAM_ERROR_MAPPINGS } from './presentation/team-error.mapping';

/**
 * Team Management's composition root: binds its ports to adapters and registers its error
 * table. It exports no providers; other contexts reach it only through contracts/ and the buses.
 */
@Module({
  // CqrsModule.forRoot() lives in AppModule only: one root, one bus (see cqrs-root.spec.ts).
  imports: [CqrsModule],
  controllers: [TeamsController],
  providers: [
    CreateTeamHandler,
    GetTeamHandler,
    { provide: TeamRepository, useClass: PrismaTeamRepository },
    { provide: TeamReadModel, useClass: PrismaTeamReadModel },
    { provide: TeamTaskCounts, useClass: ZeroTeamTaskCounts },
    { provide: Clock, useClass: SystemClock },
    { provide: IdGenerator, useClass: UuidGenerator },
  ],
})
export class TeamsModule implements OnModuleInit {
  constructor(private readonly errorMappings: DomainErrorMappings) {}

  onModuleInit(): void {
    this.errorMappings.register(TEAM_ERROR_MAPPINGS);
  }
}
