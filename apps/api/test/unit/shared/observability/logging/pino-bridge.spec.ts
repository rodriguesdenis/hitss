import pino from 'pino';
import { LogCapture } from '../../../../support/logging/capture';
import { createAuthLogger } from '../../../../../src/shared/observability/logging/pino-bridge';
import {
  REDACT_PATHS,
  REDACTED,
} from '../../../../../src/shared/observability/logging/redact-paths';

const value = 'credential-value'.repeat(2);

function bridge() {
  const out = new LogCapture();
  const logger = pino(
    { redact: { paths: REDACT_PATHS, censor: REDACTED } },
    out,
  );
  return { out, auth: createAuthLogger(logger) };
}

describe('Better Auth pino bridge', () => {
  it('AC-06.3.8 arrives as a pino warn entry', () => {
    const { out, auth } = bridge();
    auth.log('warn', 'Invalid credentials');
    expect(out.lines[0]).toMatchObject({
      level: 40,
      msg: 'Invalid credentials',
      source: 'better-auth',
    });
  });

  it('AC-06.3.8 maps error to pino error', () => {
    const { out, auth } = bridge();
    auth.log('error', 'boom');
    expect(out.lines[0]).toMatchObject({ level: 50 });
  });

  it.each([
    ['info', 30],
    ['debug', 20],
  ] as const)(
    'AC-06.3.8 maps %s to the same pino level',
    (level, pinoLevel) => {
      const out = new LogCapture();
      const auth = createAuthLogger(pino({ level: 'debug' }, out));
      auth.log(level, 'note');
      expect(out.lines[0]).toMatchObject({ level: pinoLevel });
    },
  );

  it('AC-06.3.8 strips URL query strings and masks emails in the message', () => {
    const { out, auth } = bridge();
    auth.log(
      'warn',
      'Invalid callbackURL https://x.example/cb?token=secret-value for someone@example.test',
    );
    expect(out.raw).not.toContain('secret-value');
    expect(out.raw).not.toContain('someone@example.test');
    expect(out.lines[0]?.msg).toBe(
      'Invalid callbackURL https://x.example/cb for [email]',
    );
  });

  it('AC-06.3.8 forwards only the allowlisted shallow fields of object arguments', () => {
    const { out, auth } = bridge();
    auth.log(
      'warn',
      'failed',
      {
        code: 'INVALID_TOKEN',
        status: 401,
        name: 'APIError',
        body: { password: value },
        headers: { authorization: value },
        user: { email: 'someone@example.test' },
      },
      value,
      42,
    );
    expect(out.lines[0]?.details).toEqual([
      { code: 'INVALID_TOKEN', status: 401, name: 'APIError' },
    ]);
    expect(out.raw).not.toContain(value);
    expect(out.raw).not.toContain('someone@example.test');
  });
});
