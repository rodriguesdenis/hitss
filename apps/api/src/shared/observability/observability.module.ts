import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { createLoggerParams } from './logging/logger.config';

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
