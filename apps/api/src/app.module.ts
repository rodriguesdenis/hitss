import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { ObservabilityModule } from './shared/observability/observability.module';

@Module({
  imports: [AppConfigModule.forRoot(), PrismaModule, ObservabilityModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
