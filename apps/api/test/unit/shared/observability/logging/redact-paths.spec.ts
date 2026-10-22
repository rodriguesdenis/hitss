import pino from 'pino';
import { LogCapture } from '../../../../support/logging/capture';
import {
  REDACT_PATHS,
  REDACTED,
} from '../../../../../src/shared/observability/logging/redact-paths';

// Built at runtime with low entropy so scanners never mistake fixtures for real secrets.
const secret = (name: string) => `${name}-value`.repeat(2);

function logOf(payload: object): string {
  const out = new LogCapture();
  pino({ redact: { paths: REDACT_PATHS, censor: REDACTED } }, out).info(
    payload,
    'x',
  );
  return out.raw;
}

describe('REDACT_PATHS', () => {
  const fields = [
    'password',
    'newPassword',
    'currentPassword',
    'token',
    'accessToken',
    'refreshToken',
    'idToken',
    'sessionToken',
    'apiKey',
    'authorization',
    'Authorization',
    'cookie',
    'Cookie',
    'connectionString',
    'databaseUrl',
    'DATABASE_URL',
    'BETTER_AUTH_SECRET',
  ];

  it.each(fields)('AC-06.3.3 redacts %s at depth 0 to 3', (field) => {
    const value = secret(field);
    const nested = {
      [field]: value,
      a: { [field]: value },
      b: { c: { [field]: value } },
      d: { e: { f: { [field]: value } } },
    };
    const raw = logOf(nested);
    expect(raw).not.toContain(value);
    expect(raw.split(REDACTED).length - 1).toBe(4);
  });

  it('AC-06.3.3 redacts credential headers on req and res', () => {
    const auth = secret('authorization');
    const cookie = secret('cookie');
    const setCookie = secret('set-cookie');
    const setToken = secret('set-auth-token');
    const raw = logOf({
      req: { headers: { authorization: auth, cookie, accept: 'json' } },
      res: { headers: { 'set-cookie': setCookie, 'set-auth-token': setToken } },
    });
    for (const value of [auth, cookie, setCookie, setToken]) {
      expect(raw).not.toContain(value);
    }
    expect(raw).toContain('json');
  });

  it.each(['set-cookie', 'set-auth-token'])(
    'AC-06.3.3 redacts the dashed field %s at depth 0 to 3',
    (field) => {
      const value = secret(field);
      const raw = logOf({
        [field]: value,
        a: { [field]: value },
        b: { c: { [field]: value } },
        d: { e: { f: { [field]: value } } },
      });
      expect(raw).not.toContain(value);
    },
  );

  it('AC-06.3.8 redacts credentials in headers nested inside arrays of details', () => {
    const value = secret('authorization');
    const raw = logOf({ details: [{ headers: { authorization: value } }] });
    expect(raw).not.toContain(value);
    expect(raw).toContain(REDACTED);
  });

  it('AC-06.3.8 redacts secrets inside arrays of nested objects', () => {
    const value = secret('password');
    const raw = logOf({
      list: [{ user: { password: value } }, { token: value }],
    });
    expect(raw).not.toContain(value);
  });

  it('AC-06.3.6 redacts email addresses but keeps err.name', () => {
    const raw = logOf({
      ctx: { email: 'someone@example.test' },
      err: { name: 'Boom' },
    });
    expect(raw).not.toContain('someone@example.test');
    expect(raw).toContain('Boom');
  });
});
