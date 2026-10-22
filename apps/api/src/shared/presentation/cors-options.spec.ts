import { ALLOWED_HEADERS, corsOptions, EXPOSED_HEADERS } from './cors-options';

describe('corsOptions', () => {
  it('an allowlist reflects only listed origins, with credentials (cookie sessions)', () => {
    expect(
      corsOptions(['https://app.example.test', 'http://localhost:8081']),
    ).toEqual({
      origin: ['https://app.example.test', 'http://localhost:8081'],
      credentials: true,
      allowedHeaders: ALLOWED_HEADERS,
      exposedHeaders: EXPOSED_HEADERS,
      maxAge: 600,
    });
  });

  it.each([[['*']], [['https://app.example.test', '*']]])(
    'PR #19: %j answers a literal * and never combines an origin with credentials',
    (origins) => {
      expect(corsOptions(origins)).toEqual({
        origin: '*',
        credentials: false,
        exposedHeaders: EXPOSED_HEADERS,
        maxAge: 600,
      });
    },
  );

  it('Lynx #36: an allowlist allows only the API request headers, never expo-origin', () => {
    expect(ALLOWED_HEADERS.map((header) => header.toLowerCase())).toEqual([
      'content-type',
      'authorization',
      'if-match',
      'idempotency-key',
      'x-request-id',
    ]);
    expect(corsOptions(['https://app.example.test'])?.allowedHeaders).toBe(
      ALLOWED_HEADERS,
    );
  });

  it('PR #29: an empty list means no CORS at all (nothing to register)', () => {
    expect(corsOptions([])).toBeUndefined();
  });

  it('exposes the headers the app reads', () => {
    expect(EXPOSED_HEADERS).toEqual([
      'set-auth-token',
      'ETag',
      'Location',
      'X-Request-Id',
      'Retry-After',
      'Idempotent-Replayed',
    ]);
  });

  it('copies the list so later changes to the config array cannot widen it', () => {
    const origins = ['https://app.example.test'];
    const options = corsOptions(origins);
    origins.push('https://evil.example.test');

    expect(options?.origin).toEqual(['https://app.example.test']);
  });
});
