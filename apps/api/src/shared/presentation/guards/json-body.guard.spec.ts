import { ExecutionContext } from '@nestjs/common';
import { ApiException } from '../filters/api-exception';
import { JsonBodyGuard } from './json-body.guard';

const guard = new JsonBodyGuard();
const context = (method: string, headers: Record<string, string>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  }) as unknown as ExecutionContext;

describe('JsonBodyGuard', () => {
  it.each([
    ['POST', 'text/plain'],
    ['PUT', 'application/x-www-form-urlencoded'],
    ['PATCH', 'multipart/form-data; boundary=x'],
    ['POST', 'application/jsonp'],
  ])(
    'AC-01.5.9 a %s body sent as %s → 415, whatever the credential',
    (method, type) => {
      for (const authorization of [undefined, 'Bearer token.sig']) {
        let error: unknown;
        try {
          guard.canActivate(
            context(method, {
              'content-type': type,
              'content-length': '5',
              ...(authorization ? { authorization } : {}),
            }),
          );
        } catch (caught) {
          error = caught;
        }

        expect(error).toBeInstanceOf(ApiException);
        expect(error).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
        expect((error as ApiException).getStatus()).toBe(415);
      }
    },
  );

  it('AC-01.5.9 a chunked body with no Content-Type → 415', () => {
    expect(() =>
      guard.canActivate(context('PUT', { 'transfer-encoding': 'chunked' })),
    ).toThrow(ApiException);
  });

  it.each([
    ['JSON', { 'content-type': 'application/json', 'content-length': '2' }],
    [
      'JSON with a charset',
      {
        'content-type': 'Application/JSON; charset=utf-8',
        'content-length': '2',
      },
    ],
    ['no body', {}],
    ['an empty body', { 'content-type': 'text/plain', 'content-length': '0' }],
  ])('passes a POST with %s', (_label, headers: Record<string, string>) => {
    expect(guard.canActivate(context('POST', headers))).toBe(true);
  });

  it.each(['GET', 'DELETE', 'HEAD', 'OPTIONS'])(
    'does not check %s',
    (method) => {
      expect(
        guard.canActivate(
          context(method, {
            'content-type': 'text/plain',
            'content-length': '5',
          }),
        ),
      ).toBe(true);
    },
  );
});
