import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TeamsModule } from './modules/teams/teams.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { ObservabilityModule } from './shared/observability/observability.module';
import { HttpConventionsModule } from './shared/presentation/http-conventions.module';

@Module({
  // ObservabilityModule stays last: its shutdown hook must run after the other modules' destroy
  // hooks (Prisma pool), so that telemetry emitted while closing is still flushed.
  imports: [
    // The only CqrsModule.forRoot() of the API: one root, one EventBus (see cqrs-root.spec.ts).
    CqrsModule.forRoot(),
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
  providers: [],
})
export class AppModule {}
