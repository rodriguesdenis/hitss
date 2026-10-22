import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { setupApp } from '../../src/app.setup';
import { GracefulExit } from '../../src/graceful-exit';
import { AppConfigModule } from '../../src/config/config.module';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { PrismaModule } from '../../src/shared/infrastructure/prisma/prisma.module';
import { ObservabilityModule } from '../../src/shared/observability/observability.module';
import { HttpConventionsModule } from '../../src/shared/presentation/http-conventions.module';

@Controller()
class PingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('ping')
  async ping() {
    await this.prisma.$queryRaw`SELECT 1 AS one`;
    return { ok: true };
  }
}

@Module({
  imports: [
    AppConfigModule.forRoot(),
    PrismaModule,
    HttpConventionsModule,
    ObservabilityModule,
  ],
  controllers: [PingController],
  providers: [GracefulExit],
})
class FixtureModule {}

async function main() {
  const app = setupApp(
    await NestFactory.create(FixtureModule, { logger: false }),
  );
  await app.listen(Number(process.env.PORT), '127.0.0.1');
  process.stdout.write('READY\n');
}
void main();
