import {
  Controller,
  Get,
  INestApplication,
  Module,
  Param,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger, LoggerModule, PinoLogger } from 'nestjs-pino';
import { createLoggerParams } from '../../../src/shared/observability/logging/logger.config';
import { LogCapture } from './capture';

@Controller()
export class FixtureController {
  constructor(private readonly logger: PinoLogger) {}

  @Get('api/v1/tasks/:id')
  one(@Param('id') id: string) {
    this.logger.info('inside handler');
    return { id };
  }

  @Get('api/v1/health/live')
  live() {
    return { status: 'up' };
  }

  @Get('api/auth/verify')
  verify() {
    return {};
  }
}

/**
 * One app per test file: nestjs-pino keeps its root logger in module state, so a second app in
 * the same file would keep writing to the first app's destination.
 */
export async function bootLogApp(level: string) {
  const out = new LogCapture();
  @Module({
    imports: [
      LoggerModule.forRoot(createLoggerParams({ level, pretty: false }, out)),
    ],
    controllers: [FixtureController],
  })
  class FixtureModule {}
  const moduleRef = await Test.createTestingModule({
    imports: [FixtureModule],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication({
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  await app.init();
  return { app, out };
}
