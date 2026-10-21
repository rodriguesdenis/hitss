import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { createLoggerParams } from './logging/logger.config';
import { TelemetryShutdown } from './telemetry/telemetry-shutdown';

/**
 * Structured logging (pino) with trace correlation and redaction, plus telemetry shutdown.
 * Logs leave the process on stdout only: there is deliberately no OTLP log pipeline (see
 * instrumentation.ts); the e2e in test/telemetry proves /v1/logs is never called.
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
  providers: [TelemetryShutdown],
})
export class ObservabilityModule {}
