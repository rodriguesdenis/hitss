import { loadAppConfig } from './load-config';
import { VALID_ENV } from './testing/expect-invalid';

describe('loadAppConfig', () => {
  it('AC-07.1.4 returns the validated application config for the given environment', () => {
    const config = loadAppConfig({ ...VALID_ENV, SEED_DEMO: 'false' });
    expect(config.seedDemo).toBe(false);
    expect(config.databaseUrl).toBe(VALID_ENV.DATABASE_URL);
  });

  it('AC-06.5.5 refuses an invalid environment naming the variable', () => {
    expect(() => loadAppConfig({ ...VALID_ENV, PORT: 'nope' })).toThrow('PORT');
  });
});
