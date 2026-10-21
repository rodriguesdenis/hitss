import { DomainError } from '../../domain/domain-error';
import { DomainErrorMappings } from './domain-error-mappings';

class NotFound extends DomainError {
  constructor() {
    super('Not found.');
  }
}

class SpecialNotFound extends NotFound {}

class Unmapped extends DomainError {
  constructor() {
    super('Unmapped.');
  }
}

describe('DomainErrorMappings', () => {
  it('a registered domain error maps to its status and code', () => {
    const registry = new DomainErrorMappings();
    registry.register([
      { error: NotFound, status: 404, code: 'THING_NOT_FOUND' },
    ]);

    expect(registry.find(new NotFound())).toMatchObject({
      status: 404,
      code: 'THING_NOT_FOUND',
    });
    expect(registry.find(new Unmapped())).toBeUndefined();
    expect(registry.find(new Error('plain'))).toBeUndefined();
  });

  it('a subclass uses its own mapping, or else its closest mapped ancestor', () => {
    const registry = new DomainErrorMappings();
    registry.register([
      { error: NotFound, status: 404, code: 'THING_NOT_FOUND' },
    ]);

    expect(registry.find(new SpecialNotFound())?.code).toBe('THING_NOT_FOUND');

    registry.register([
      { error: SpecialNotFound, status: 410, code: 'THING_GONE' },
    ]);

    expect(registry.find(new SpecialNotFound())?.code).toBe('THING_GONE');
    expect(registry.find(new NotFound())?.code).toBe('THING_NOT_FOUND');
  });

  it('collects the tables of every module and refuses a class mapped twice', () => {
    const registry = new DomainErrorMappings();
    registry.register([
      { error: NotFound, status: 404, code: 'THING_NOT_FOUND' },
    ]);
    registry.register([{ error: Unmapped, status: 409, code: 'OTHER' }]);

    expect(registry.all().map((m) => m.code)).toEqual([
      'THING_NOT_FOUND',
      'OTHER',
    ]);
    expect(() =>
      registry.register([{ error: NotFound, status: 400, code: 'AGAIN' }]),
    ).toThrow('NotFound is already mapped');
  });
});
