import { toAppConfig } from './app-config';
import { validate } from './env.validation';
import {
  expectInvalid,
  PRODUCTION_ENV,
  VALID_ENV,
} from './testing/expect-invalid';

const check = (env: Record<string, string>, variable: string) =>
  expectInvalid(validate, env, variable);

describe('auth and security variables', () => {
  it('AC-01.8.5 a valid local environment parses with the documented defaults', () => {
    expect(toAppConfig(validate({ ...VALID_ENV }))).toMatchObject({
      betterAuthUrl: 'http://localhost:3000',
      corsOrigins: ['http://localhost:8081'],
      appScheme: 'teamstasks',
      trustedProxies: [],
      authRateLimitEnabled: true,
      rateLimitIpMax: 300,
      seedDemo: true,
      docsEnabled: true,
    });
  });

  it('parses comma-separated lists, trimming spaces and dropping empty entries', () => {
    const config = toAppConfig(
      validate({
        ...VALID_ENV,
        CORS_ORIGINS:
          ' https://app.example.test , https://admin.example.test:8443,',
        TRUSTED_PROXIES: '10.0.0.0/8, 192.168.1.10,::1, fd00::/8',
        RATE_LIMIT_IP_MAX: '50',
        AUTH_RATE_LIMIT_ENABLED: 'false',
        SEED_DEMO: 'false',
        DOCS_ENABLED: 'false',
      }),
    );

    expect(config).toMatchObject({
      corsOrigins: [
        'https://app.example.test',
        'https://admin.example.test:8443',
      ],
      trustedProxies: ['10.0.0.0/8', '192.168.1.10', '::1', 'fd00::/8'],
      rateLimitIpMax: 50,
      authRateLimitEnabled: false,
      seedDemo: false,
      docsEnabled: false,
    });
  });

  it('empty CORS_ORIGINS and TRUSTED_PROXIES mean none', () => {
    expect(
      toAppConfig(
        validate({ ...VALID_ENV, CORS_ORIGINS: '', TRUSTED_PROXIES: '' }),
      ),
    ).toMatchObject({ corsOrigins: [], trustedProxies: [] });
  });

  it.each([
    ['BETTER_AUTH_URL', 'not-a-url'],
    ['BETTER_AUTH_URL', 'localhost:3000'],
    ['BETTER_AUTH_URL', 'ftp://files.example.test'],
    ['CORS_ORIGINS', 'app.example.test'],
    ['CORS_ORIGINS', 'https://app.example.test/path'],
    ['CORS_ORIGINS', 'https://app.example.test,teamstasks://'],
    ['APP_SCHEME', 'TeamsTasks'],
    ['APP_SCHEME', '1teams'],
    ['APP_SCHEME', 'teams tasks'],
    ['APP_SCHEME', ''],
    ['TRUSTED_PROXIES', 'proxy.example.test'],
    ['TRUSTED_PROXIES', '10.0.0.0/33'],
    ['TRUSTED_PROXIES', '::1/129'],
    ['TRUSTED_PROXIES', '10.0.0.0/'],
    ['TRUSTED_PROXIES', '10.0.0.0/8/1'],
    ['TRUSTED_PROXIES', '10.0.0.0/08x'],
    ['TRUSTED_PROXIES', '0.0.0.0/0'],
    ['TRUSTED_PROXIES', '::/0'],
    ['TRUSTED_PROXIES', '10.0.0.0/8,0.0.0.0/0'],
    ['AUTH_RATE_LIMIT_ENABLED', 'yes'],
    ['RATE_LIMIT_IP_MAX', '0'],
    ['RATE_LIMIT_IP_MAX', '1.5'],
    ['RATE_LIMIT_IP_MAX', 'many'],
    ['SEED_DEMO', 'maybe'],
    ['DOCS_ENABLED', 'on'],
  ])(
    'AC-01.8.5 %s=%j is rejected naming the variable, not the value',
    (variable, value) => {
      check({ [variable]: value }, variable);
    },
  );
});

describe('APP_SCHEME reserved schemes (every environment)', () => {
  // The scheme becomes a Better Auth trusted origin matched by prefix: `http` would trust
  // every http:// origin. Expo Go's exp:// is added by the auth module, never through here.
  it.each([
    'http',
    'https',
    'ws',
    'wss',
    'file',
    'ftp',
    'data',
    'javascript',
    'blob',
    'about',
    'exp',
    'exps',
  ])('AC-01.8.5 %s is refused even with APP_ENV=local', (scheme) => {
    check({ APP_ENV: 'local', APP_SCHEME: scheme }, 'APP_SCHEME');
  });

  it.each(['teamstasks', 'teams-tasks', 'com.example.teams+dev'])(
    '%s is accepted',
    (scheme) => {
      expect(
        toAppConfig(validate({ ...VALID_ENV, APP_SCHEME: scheme })).appScheme,
      ).toBe(scheme);
    },
  );
});

describe('auth and security production rules (AC-01.8.5)', () => {
  const production = PRODUCTION_ENV;

  it('a fully valid production configuration passes', () => {
    expect(() => validate({ ...production })).not.toThrow();
  });

  it('BETTER_AUTH_URL must be https', () => {
    check(
      { ...production, BETTER_AUTH_URL: 'http://api.example.test' },
      'BETTER_AUTH_URL',
    );
  });

  it.each([
    ['a wildcard', '*'],
    ['an http:// origin', 'https://app.example.test,http://web.example.test'],
    ['localhost', 'https://localhost:8081'],
    ['a localhost subdomain', 'https://app.localhost'],
    ['an IPv4 loopback address', 'https://127.0.0.1:8443'],
    ['the IPv6 loopback address', 'https://[::1]'],
  ])('CORS_ORIGINS must not contain %s', (_label, origins) => {
    check({ ...production, CORS_ORIGINS: origins }, 'CORS_ORIGINS');
  });

  it('AUTH_RATE_LIMIT_ENABLED=false is refused', () => {
    check(
      { ...production, AUTH_RATE_LIMIT_ENABLED: 'false' },
      'AUTH_RATE_LIMIT_ENABLED',
    );
  });

  it('AC-01.8.4 SEED_DEMO=true is refused', () => {
    check({ ...production, SEED_DEMO: 'true' }, 'SEED_DEMO');
  });

  it.each([
    ['an IPv4 range wider than /8', '10.0.0.0/7'],
    ['an IPv6 range wider than /16', 'fd00::/15'],
    ['one wide range among narrow ones', '10.1.0.0/16,192.0.0.0/2'],
  ])('TRUSTED_PROXIES must not contain %s', (_label, proxies) => {
    check({ ...production, TRUSTED_PROXIES: proxies }, 'TRUSTED_PROXIES');
  });

  it('TRUSTED_PROXIES accepts /8 (IPv4), /16 (IPv6) and single addresses', () => {
    expect(() =>
      validate({
        ...production,
        TRUSTED_PROXIES: '10.0.0.0/8,fd00::/16,192.168.1.10,::1',
      }),
    ).not.toThrow();
  });

  it('AC-01.8.6 DOCS_ENABLED resolves to false, whatever is configured', () => {
    expect(
      toAppConfig(validate({ ...production, DOCS_ENABLED: 'true' }))
        .docsEnabled,
    ).toBe(false);
  });

  it('the same values pass with APP_ENV=local, where DOCS_ENABLED is kept', () => {
    const config = toAppConfig(
      validate({
        ...VALID_ENV,
        APP_ENV: 'local',
        BETTER_AUTH_URL: 'http://localhost:3000',
        CORS_ORIGINS: '*,http://localhost:8081,https://127.0.0.1:8443',
        AUTH_RATE_LIMIT_ENABLED: 'false',
        SEED_DEMO: 'true',
        DOCS_ENABLED: 'true',
        TRUSTED_PROXIES: '10.0.0.0/7,fd00::/15',
      }),
    );

    expect(config.docsEnabled).toBe(true);
  });
});
