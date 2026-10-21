import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_CONFIG, toAppConfig } from './app-config';
import { EnvironmentVariables } from './env.schema';
import { envFilePaths, ignoreEnvFiles } from './env-files';
import { validate } from './env.validation';

@Global()
@Module({})
export class AppConfigModule {
  /** Validates the environment when called, so the process fails fast at module composition. */
  static forRoot(): DynamicModule {
    let validated: EnvironmentVariables | undefined;
    return {
      module: AppConfigModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: envFilePaths(__dirname),
          ignoreEnvFile: ignoreEnvFiles(process.env.APP_ENV),
          validate: (config) => (validated = validate(config)),
        }),
      ],
      providers: [
        {
          provide: APP_CONFIG,
          useFactory: () => {
            if (!validated) {
              throw new Error('Configuration was not validated');
            }
            return toAppConfig(validated);
          },
        },
      ],
      exports: [APP_CONFIG],
    };
  }
}
