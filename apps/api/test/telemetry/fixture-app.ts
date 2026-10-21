// Test-only Nest app started with `-r ./src/instrumentation.ts`, like production uses --import.
// `GET /ping` opens a child span that stands in for the database span until PrismaModule lands.
import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { trace } from '@opentelemetry/api';
import { registerGracefulShutdown } from '../../src/shared/observability/telemetry/graceful-shutdown';

@Controller()
class PingController {
  @Get('ping')
  ping() {
    return trace.getTracer('fixture').startActiveSpan('fixture.db', (span) => {
      span.end();
      return { ok: true };
    });
  }
}

@Module({ controllers: [PingController] })
class FixtureModule {}

async function main() {
  const app = await NestFactory.create(FixtureModule, { logger: false });
  registerGracefulShutdown(app);
  await app.listen(Number(process.env.PORT), '127.0.0.1');
  process.stdout.write('READY\n');
}
void main();
