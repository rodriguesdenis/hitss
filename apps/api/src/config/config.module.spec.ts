import { Test } from '@nestjs/testing';
import { APP_CONFIG, AppConfig } from './app-config';
import { AppConfigModule } from './config.module';
import { VALID_ENV } from './testing/expect-invalid';

describe('AppConfigModule', () => {
  const keys = [...Object.keys(VALID_ENV), 'PORT', 'APP_ENV'];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) saved[key] = process.env[key];
    Object.assign(process.env, VALID_ENV, { PORT: '3100', APP_ENV: 'test' });
  });

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('AC-07.1.4 provides the typed AppConfig built from validated variables', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule.forRoot()],
    }).compile();

    const config = moduleRef.get<AppConfig>(APP_CONFIG);

    expect(config.port).toBe(3100);
    expect(config.appEnv).toBe('test');
    expect(config.databaseUrl).toBe(VALID_ENV.DATABASE_URL);
    expect(config.betterAuthSecret).toBe(VALID_ENV.BETTER_AUTH_SECRET);
    expect(config.rateLimitMax).toBe(100);
  });

  it('AC-06.5.5 refuses to build the module when a variable is invalid', async () => {
    process.env.PORT = 'not-a-port';

    await expect(
      Test.createTestingModule({
        imports: [AppConfigModule.forRoot()],
      }).compile(),
    ).rejects.toThrow('PORT');
  });
});
