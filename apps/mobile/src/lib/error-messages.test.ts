import { ApiError } from '@hitss/api-client';

import { errorCode, errorMessage, errorMessages } from './error-messages';

const apiError = (status: number, code: string) =>
  new ApiError(status, {
    error: { code, message: 'server text', traceId: 't' },
  });

describe('error messages', () => {
  it.each([
    [400, 'VALIDATION_FAILED'],
    [401, 'UNAUTHENTICATED'],
    [404, 'TASK_NOT_FOUND'],
    [404, 'TEAM_NOT_FOUND'],
    [404, 'ROUTE_NOT_FOUND'],
    [409, 'TEAM_NAME_ALREADY_EXISTS'],
    [422, 'UNKNOWN_TEAMS'],
    [422, 'TOO_MANY_TEAMS'],
    [500, 'INTERNAL_ERROR'],
  ] as const)('AC-04.9.5 maps %i %s to its pt-BR copy', (status, code) => {
    const error = apiError(status, code);
    expect(errorCode(error)).toBe(code);
    expect(errorMessage(error)).toBe(errorMessages[code]);
  });

  it('AC-04.9.5 never shows the server message', () => {
    expect(errorMessage(apiError(500, 'INTERNAL_ERROR'))).not.toContain(
      'server text',
    );
  });

  it('AC-04.9.5 falls back to the generic message for an unknown code', () => {
    expect(errorMessage(apiError(418, 'TEAPOT'))).toBe(
      'Algo deu errado do nosso lado. Tente novamente.',
    );
  });

  it('falls back to the generic message for a non-envelope body', () => {
    expect(errorCode(new ApiError(502, '<html>Bad gateway</html>'))).toBe(
      'INTERNAL_ERROR',
    );
    expect(errorCode(new ApiError(503, undefined))).toBe('INTERNAL_ERROR');
  });

  it('fills the rate-limit seconds', () => {
    expect(
      errorMessage(apiError(429, 'RATE_LIMITED'), { retryAfterSeconds: 12 }),
    ).toBe('Muitas requisições. Tente novamente em 12 s.');
  });

  it('maps a fetch network failure', () => {
    expect(errorMessage(new TypeError('Network request failed'))).toBe(
      'Não foi possível conectar ao servidor. Verifique sua conexão.',
    );
  });

  it('maps a timeout', () => {
    const timeout = new Error('The operation timed out.');
    timeout.name = 'TimeoutError';
    expect(errorCode(timeout)).toBe('TIMEOUT');
  });

  it('maps anything else to the generic message', () => {
    expect(errorCode('boom')).toBe('INTERNAL_ERROR');
  });
});
