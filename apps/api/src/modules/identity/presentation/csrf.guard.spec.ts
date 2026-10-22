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
  session: unknown = { id: 'session-1' },
) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ method, url, originalUrl: url, headers, session }),
    }),
  }) as unknown as ExecutionContext;

const COOKIE = { cookie: 'better-auth.session_token=abc.def' };
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
    'text/plain',
    'application/x-www-form-urlencoded',
    'multipart/form-data; boundary=x',
  ])(
    'AC-01.5.9 a cookie-authenticated body sent as %s → 415 UNSUPPORTED_MEDIA_TYPE',
    (type) => {
      const error = rejection('POST', {
        ...COOKIE,
        'content-type': type,
        'content-length': '5',
      });

      expect(error).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
      expect((error as ApiException).getStatus()).toBe(415);
    },
  );

  it('AC-01.5.9 a body with no Content-Type → 415', () => {
    expect(
      rejection('PUT', { ...COOKIE, 'transfer-encoding': 'chunked' }),
    ).toMatchObject({
      code: 'UNSUPPORTED_MEDIA_TYPE',
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
        authorization: 'Bearer token.sig',
        'content-type': 'text/plain',
        'content-length': '5',
      },
    ],
    [
      'an untrusted Origin',
      {
        authorization: 'Bearer token.sig',
        ...COOKIE,
        ...JSON_BODY,
        origin: 'https://evil.example.test',
      },
    ],
    [
      'cross-site fetch metadata',
      {
        authorization: 'bearer token.sig',
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

  it('only /api/v1 is checked (Better Auth runs its own origin check on /api/auth)', () => {
    expect(
      guard.canActivate(
        context(
          'POST',
          { ...COOKIE, origin: 'https://evil.example.test' },
          '/api/auth/sign-out',
        ),
      ),
    ).toBe(true);
  });
});
