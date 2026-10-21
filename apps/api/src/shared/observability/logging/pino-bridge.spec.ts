import pino from 'pino';
import { LogCapture } from '../../../../test/support/logging/capture';
import { createAuthLogger } from './pino-bridge';
import { REDACT_PATHS, REDACTED } from './redact-paths';

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

  it('AC-06.3.8 redacts nested secrets and drops primitive arguments', () => {
    const { out, auth } = bridge();
    auth.log(
      'warn',
      'failed',
      { user: { password: value } },
      [{ a: { token: value } }],
      value,
      42,
    );
    expect(out.raw).not.toContain(value);
    expect(out.raw).toContain(REDACTED);
  });
});
