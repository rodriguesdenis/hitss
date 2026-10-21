import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toAppConfig } from './app-config';
import { validate } from './env.validation';
import { expectInvalid } from './testing/expect-invalid';

function parseEnvFile(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      env[match[1]] = match[2];
    }
  }
  return env;
}

const example = parseEnvFile(join(__dirname, '../../../../.env.example'));

describe('.env.example', () => {
  it('AC-07.1.4 is a valid configuration as shipped', () => {
    expect(() => validate({ ...example })).not.toThrow();
  });

  it('AC-07.1.4 documents exactly the defaults built into the schema', () => {
    const required = {
      DATABASE_URL: example.DATABASE_URL,
      BETTER_AUTH_SECRET: example.BETTER_AUTH_SECRET,
    };

    expect(toAppConfig(validate({ ...example }))).toEqual(
      toAppConfig(validate(required)),
    );
  });

  it('AC-06.5.5 its placeholder secret is refused when APP_ENV=production', () => {
    expectInvalid(
      validate,
      { ...example, APP_ENV: 'production' },
      'BETTER_AUTH_SECRET',
    );
  });
});
