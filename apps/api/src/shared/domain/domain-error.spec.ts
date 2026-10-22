import { DomainError } from './domain-error';

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
