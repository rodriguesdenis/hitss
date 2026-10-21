import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_CONFIG, toAppConfig } from './app-config';
import { EnvironmentVariables } from './env.schema';
import { validate } from './env.validation';

@Global()
@Module({})
export class AppConfigModule {
  /** Validates the environment when called, so the process fails fast at module composition. */
  static forRoot(): DynamicModule {
    return {
      module: AppConfigModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          // Local development: apps/api/.env first, then the repository-root .env.
          envFilePath: ['.env', '../../.env'],
          validate,
        }),
      ],
      providers: [
        {
          provide: APP_CONFIG,
          inject: [ConfigService],
          useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
            toAppConfig(
              Object.fromEntries(
                Object.keys(new EnvironmentVariables()).map((key) => [
                  key,
                  config.get(key as keyof EnvironmentVariables),
                ]),
              ) as unknown as EnvironmentVariables,
            ),
        },
      ],
      exports: [APP_CONFIG],
    };
  }
}
