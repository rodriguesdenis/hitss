import { ConcurrencyConflict, DomainError } from './domain-error';

class SampleError extends DomainError {
  constructor() {
    super('sample message');
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
});

describe('ConcurrencyConflict', () => {
  it('AC-02.9.2 carries the current version', () => {
    const error = new ConcurrencyConflict(5);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('ConcurrencyConflict');
    expect(error.currentVersion).toBe(5);
    expect(error.message).toBe(
      'The resource was modified (current version 5).',
    );
  });
});
