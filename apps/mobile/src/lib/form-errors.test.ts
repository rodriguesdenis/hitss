import { ApiError } from '@hitss/api-client';

import {
  errorCountMessage,
  errorDetails,
  validationFields,
} from './form-errors';

const apiError = (details: unknown) =>
  new ApiError(400, {
    error: { code: 'VALIDATION_FAILED', message: 'x', traceId: 't', details },
  });

describe('form errors', () => {
  it('lists the fields of a validation failure', () => {
    expect(
      validationFields(
        apiError([
          { field: 'title', message: 'too short' },
          { field: 'teamIds', message: 'x' },
        ]),
      ),
    ).toEqual(['title', 'teamIds']);
  });

  it('returns no fields for other details or errors', () => {
    expect(validationFields(apiError({ teamIds: ['a'] }))).toEqual([]);
    expect(validationFields(new TypeError('offline'))).toEqual([]);
    expect(errorDetails(new ApiError(502, '<html>'))).toBeUndefined();
  });

  it('AC-04.7.2 counts the errors in pt-BR', () => {
    expect(errorCountMessage(1)).toBe('Corrija 1 erro para continuar');
    expect(errorCountMessage(3)).toBe('Corrija 3 erros para continuar');
  });
});
