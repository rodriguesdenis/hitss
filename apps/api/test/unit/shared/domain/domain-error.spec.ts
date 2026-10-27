import {
  DomainError,
  InvalidField,
} from '../../../../src/shared/domain/domain-error';

class SampleError extends DomainError {
  readonly code = 'SAMPLE';
  readonly kind = 'rule';

  constructor(details?: unknown) {
    super('sample message', details);
  }
}

class InvalidSample extends InvalidField {
  constructor() {
    super('sample', 'sample must be a sample');
  }
}

describe('DomainError', () => {
  it('is an Error named after its concrete class', () => {
    const error = new SampleError();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('SampleError');
    expect(error.message).toBe('sample message');
  });

  it('AC-09.6 declares its code and kind, and details only when given', () => {
    expect(new SampleError()).toMatchObject({ code: 'SAMPLE', kind: 'rule' });
    expect(new SampleError().details).toBeUndefined();
    expect(new SampleError({ max: 1 }).details).toEqual({ max: 1 });
  });

  it('AC-09.6 a field error is a validation error that names its field', () => {
    const error = new InvalidSample();

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({
      code: 'VALIDATION_FAILED',
      kind: 'validation',
      field: 'sample',
      message: 'Request validation failed.',
      details: [{ field: 'sample', message: 'sample must be a sample' }],
    });
  });
});
