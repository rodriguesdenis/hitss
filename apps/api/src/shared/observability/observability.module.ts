import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { createLoggerParams } from './logging/logger.config';

/**
 * Structured logging (pino) with request id, trace id and redaction. Logs leave the process on
 * stdout only: there is no OTLP log pipeline (instrumentation.ts exports traces only).
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        createLoggerParams({
          level: config.logLevel,
          pretty: config.logPretty,
        }),
    }),
  ],
})
export class ObservabilityModule {}
