import { ExecutionContext } from '@nestjs/common';
import { toAppConfig } from '../../../config/app-config';
import { validate } from '../../../config/env.validation';
import { VALID_ENV } from '../../../config/testing/expect-invalid';
import { ApiException } from '../../../shared/presentation/filters/api-exception';
import { CsrfGuard } from './csrf.guard';

const TRUSTED = 'https://app.example.test';
const guard = new CsrfGuard(
  toAppConfig(
    validate({
      ...VALID_ENV,
      APP_ENV: 'test',
      CORS_ORIGINS: TRUSTED,
      APP_SCHEME: 'teamstasks',
    }),
  ),
);

const context = (
  method: string,
  headers: Record<string, string>,
  url = '/api/v1/teams',
  session: unknown = { session: { token: 'abc' } },
) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ method, url, originalUrl: url, headers, session }),
    }),
  }) as unknown as ExecutionContext;

const COOKIE = { cookie: 'better-auth.session_token=abc.def' };
/** The signed bearer of the same session: its token part equals the session token. */
const BEARER = 'Bearer abc.signature';
const JSON_BODY = { 'content-type': 'application/json', 'content-length': '2' };

const rejection = (
  method: string,
  headers: Record<string, string>,
  url?: string,
) => {
  try {
    guard.canActivate(context(method, headers, url));
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('CsrfGuard', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'AC-01.5.8 a cookie-authenticated %s with an untrusted Origin → 403 CSRF_REJECTED',
    (method) => {
      const error = rejection(method, {
        ...COOKIE,
        ...JSON_BODY,
        origin: 'https://evil.example.test',
      });

      expect(error).toBeInstanceOf(ApiException);
      expect(error).toMatchObject({ code: 'CSRF_REJECTED' });
      expect((error as ApiException).getStatus()).toBe(403);
    },
  );

  it('AC-01.5.8 an untrusted Referer (no Origin) → 403', () => {
    expect(
      rejection('POST', {
        ...COOKIE,
        ...JSON_BODY,
        referer: 'https://evil.example.test/form?x=1',
      }),
    ).toMatchObject({ code: 'CSRF_REJECTED' });
  });

  it('AC-01.5.8 Sec-Fetch-Site: cross-site → 403, even with a trusted Origin', () => {
    expect(
      rejection('POST', {
        ...COOKIE,
        ...JSON_BODY,
        origin: TRUSTED,
        'sec-fetch-site': 'cross-site',
      }),
    ).toMatchObject({ code: 'CSRF_REJECTED' });
  });

  it('AC-01.5.8 a malformed Referer counts as untrusted', () => {
    expect(
      rejection('POST', { ...COOKIE, ...JSON_BODY, referer: 'not a url' }),
    ).toMatchObject({
      code: 'CSRF_REJECTED',
    });
  });

  it.each([
    ['a trusted Origin and JSON', { ...COOKIE, ...JSON_BODY, origin: TRUSTED }],
    [
      'a trusted Referer',
      { ...COOKIE, ...JSON_BODY, referer: `${TRUSTED}/teams` },
    ],
    ['no Origin (native client)', { ...COOKIE, ...JSON_BODY }],
    [
      'the app scheme Origin',
      { ...COOKIE, ...JSON_BODY, origin: 'teamstasks://' },
    ],
    [
      'JSON with a charset',
      {
        ...COOKIE,
        'content-type': 'application/json; charset=utf-8',
        'content-length': '2',
      },
    ],
    ['no body (DELETE)', { ...COOKIE, origin: TRUSTED }],
    [
      'same-origin fetch metadata',
      { ...COOKIE, ...JSON_BODY, 'sec-fetch-site': 'same-site' },
    ],
  ])('passes a cookie-authenticated request with %s', (_label, headers) => {
    expect(guard.canActivate(context('POST', headers))).toBe(true);
  });

  it.each([
    [
      'no Origin',
      {
        authorization: BEARER,
        'content-type': 'text/plain',
        'content-length': '5',
      },
    ],
    [
      'an untrusted Origin',
      {
        authorization: BEARER,
        ...COOKIE,
        ...JSON_BODY,
        origin: 'https://evil.example.test',
      },
    ],
    [
      'cross-site fetch metadata',
      {
        authorization: 'bearer abc.signature',
        ...JSON_BODY,
        'sec-fetch-site': 'cross-site',
      },
    ],
  ])(
    'AC-01.5.10 a bearer request with %s is not subject to the CSRF checks',
    (_label, headers) => {
      expect(guard.canActivate(context('POST', headers))).toBe(true);
    },
  );

  it.each(['/API/V1/teams', '/Api/v1/teams/7d0c5e2a', '/api/V1/tasks'])(
    'AC-01.5.8 the path is not inspected: a cross-site cookie POST to %s → 403',
    (url) => {
      expect(
        rejection(
          'POST',
          { ...COOKIE, ...JSON_BODY, origin: 'https://evil.example.test' },
          url,
        ),
      ).toMatchObject({ code: 'CSRF_REJECTED' });
    },
  );

  it.each([
    ['garbage', 'Bearer garbage'],
    ['another session', 'Bearer other.signature'],
    ['an empty token', 'Bearer '],
    ['a malformed escape', 'Bearer %E0%A4%A'],
  ])(
    'AC-01.5.8 a bearer header with %s does not exempt a cookie session from CSRF (Lynx)',
    (_label, authorization) => {
      expect(
        rejection('POST', {
          ...COOKIE,
          ...JSON_BODY,
          authorization,
          origin: 'https://evil.example.test',
        }),
      ).toMatchObject({ code: 'CSRF_REJECTED' });
    },
  );

  it('an anonymous request (public route, no session) is not checked', () => {
    expect(
      guard.canActivate(
        context(
          'POST',
          {
            origin: 'https://evil.example.test',
            'content-type': 'text/plain',
            'content-length': '5',
          },
          '/api/v1/probe',
          null,
        ),
      ),
    ).toBe(true);
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'safe method %s is never checked',
    (method) => {
      expect(
        guard.canActivate(
          context(method, { ...COOKIE, origin: 'https://evil.example.test' }),
        ),
      ).toBe(true);
    },
  );
});
