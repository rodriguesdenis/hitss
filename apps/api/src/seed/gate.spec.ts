import { demoSeedSkipReason } from './gate';

describe('demo seed gate', () => {
  it('AC-01.8.4 runs when SEED_DEMO is true outside production', () => {
    expect(
      demoSeedSkipReason({ seedDemo: true, appEnv: 'local' }),
    ).toBeUndefined();
    expect(
      demoSeedSkipReason({ seedDemo: true, appEnv: 'test' }),
    ).toBeUndefined();
  });

  it('AC-01.8.4 skips when SEED_DEMO is false', () => {
    expect(demoSeedSkipReason({ seedDemo: false, appEnv: 'local' })).toMatch(
      /SEED_DEMO/,
    );
  });

  it('AC-01.8.4 never runs when APP_ENV is production, even with SEED_DEMO forced on', () => {
    expect(
      demoSeedSkipReason({ seedDemo: true, appEnv: 'production' }),
    ).toMatch(/production/);
  });
});
