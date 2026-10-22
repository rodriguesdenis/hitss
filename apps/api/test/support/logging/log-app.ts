import {
  Controller,
  Get,
  INestApplication,
  Module,
  Param,
  Post,
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

  @Post('api/v1/tasks')
  create() {
    return {};
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
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const call = (path: string, init?: RequestInit) =>
    fetch(`${base}${path}`, init);
  return { app, out, call };
}
