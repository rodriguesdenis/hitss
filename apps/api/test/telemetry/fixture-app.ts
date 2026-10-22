// Test-only Nest app started with `-r ./src/instrumentation.ts`, like production uses --import.
// `GET /api/v1/ping` (setupApp adds the prefix and version) runs a real query through PrismaService so the exported trace shows the DB span.
import 'reflect-metadata';
import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { setupApp } from '../../src/app.setup';
import { AppConfigModule } from '../../src/config/config.module';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { PrismaModule } from '../../src/shared/infrastructure/prisma/prisma.module';
import { ObservabilityModule } from '../../src/shared/observability/observability.module';
import { Traced } from '../../src/shared/observability/tracing/traced-handler';
import { HttpConventionsModule } from '../../src/shared/presentation/http-conventions.module';

/** Stands in for a command/query handler: the use-case span sits between HTTP and the DB. */
@Injectable()
class PingHandler {
  constructor(private readonly prisma: PrismaService) {}

  @Traced()
  async execute() {
    await this.prisma.$queryRaw`SELECT 1 AS one`;
    return { ok: true };
  }

  @Traced()
  async dbFail() {
    // The driver error echoes the bound value in its message and DETAIL text.
    await this.prisma.$queryRaw`SELECT ${'secret-value'}::int`;
  }

  @Traced()
  fail(): never {
    throw new Error('forced failure with secret-value');
  }
}

@Controller()
class PingController {
  constructor(private readonly handler: PingHandler) {}

  @Get('ping')
  ping() {
    return this.handler.execute();
  }

  @Get('dbfail')
  dbfail() {
    return this.handler.dbFail();
  }

  @Get('boom')
  boom() {
    return this.handler.fail();
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
  providers: [PingHandler],
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
