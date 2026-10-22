import { normalizeAuthInput } from '../../../hooks/auth-input';

const SIGN_UP = '/sign-up/email';
const SIGN_IN = '/sign-in/email';
const PASSWORD = ['plain', 'value', '42'].join('-');

describe('normalizeAuthInput', () => {
  it.each([
    ['1 code point', 'M', 'M'],
    ['100 code points', 'n'.repeat(100), 'n'.repeat(100)],
    ['surrounding spaces', '  Marina  ', 'Marina'],
    [
      '100 code points after trimming',
      `  ${'n'.repeat(100)}  `,
      'n'.repeat(100),
    ],
    [
      'emoji counted as one code point each',
      '🙂'.repeat(100),
      '🙂'.repeat(100),
    ],
  ])(
    'AC-01.1.5 accepts a name of %s and stores it trimmed',
    (_label, name, stored) => {
      expect(
        normalizeAuthInput(SIGN_UP, {
          name,
          email: 'a@b.test',
          password: PASSWORD,
        }),
      ).toEqual({
        ok: true,
        body: { name: stored, email: 'a@b.test', password: PASSWORD },
      });
    },
  );

  it.each([
    ['missing', undefined],
    ['blank', '   '],
    ['empty', ''],
    ['101 code points', 'n'.repeat(101)],
    ['not a string', 42],
    ['a newline', 'Mari\nna'],
    ['a NUL', 'Marina\u0000'],
    ['a trailing tab', 'Marina\t'],
  ])('AC-01.1.5 rejects a name that is %s', (_label, name) => {
    expect(
      normalizeAuthInput(SIGN_UP, {
        name,
        email: 'a@b.test',
        password: PASSWORD,
      }),
    ).toEqual({
      ok: false,
      field: 'name',
    });
  });

  it.each([SIGN_UP, SIGN_IN])('AC-01.2.6 trims the email on %s', (path) => {
    const result = normalizeAuthInput(path, {
      name: 'Demo',
      email: '  Demo@Teams-Tasks.dev ',
      password: PASSWORD,
    });

    expect(result).toMatchObject({
      ok: true,
      body: { email: 'Demo@Teams-Tasks.dev' },
    });
  });

  it.each([SIGN_UP, SIGN_IN])(
    'AC-01.2.6 never trims the password on %s',
    (path) => {
      const padded = `  ${PASSWORD} `;

      const result = normalizeAuthInput(path, {
        name: 'Demo',
        email: 'a@b.test',
        password: padded,
      });

      expect(result).toMatchObject({ ok: true, body: { password: padded } });
    },
  );

  it('sign-in has no name rule', () => {
    expect(
      normalizeAuthInput(SIGN_IN, { email: 'a@b.test', password: PASSWORD }),
    ).toEqual({
      ok: true,
      body: { email: 'a@b.test', password: PASSWORD },
    });
  });

  it.each([
    ['another route', '/get-session', { email: ' a@b.test ' }],
    ['a non-object body', SIGN_IN, 'raw'],
    ['no body', SIGN_UP, undefined],
  ])('leaves %s alone', (_label, path, body) => {
    expect(normalizeAuthInput(path, body)).toBeUndefined();
  });
});
