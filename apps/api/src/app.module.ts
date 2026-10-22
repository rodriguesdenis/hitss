import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { GracefulExit } from './graceful-exit';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TeamsModule } from './modules/teams/teams.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { ObservabilityModule } from './shared/observability/observability.module';
import { HttpConventionsModule } from './shared/presentation/http-conventions.module';

@Module({
  imports: [
    AppConfigModule.forRoot(),
    PrismaModule,
    HttpConventionsModule,
    IdentityModule,
    HealthModule,
    TeamsModule,
    TasksModule,
    ObservabilityModule,
  ],
  controllers: [],
  providers: [GracefulExit],
})
export class AppModule {}
