import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { ObservabilityModule } from './shared/observability/observability.module';

@Module({
  // ObservabilityModule stays last: its shutdown hook must run after the other modules' destroy
  // hooks (Prisma pool), so that telemetry emitted while closing is still flushed.
  imports: [AppConfigModule.forRoot(), PrismaModule, ObservabilityModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
