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
      {
        error: NotFound,
        status: 404,
        code: 'THING_NOT_FOUND',
        message: 'The thing does not exist.',
      },
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
      {
        error: NotFound,
        status: 404,
        code: 'THING_NOT_FOUND',
        message: 'The thing does not exist.',
      },
    ]);

    expect(registry.find(new SpecialNotFound())?.code).toBe('THING_NOT_FOUND');

    registry.register([
      {
        error: SpecialNotFound,
        status: 410,
        code: 'THING_GONE',
        message: 'The thing is gone.',
      },
    ]);

    expect(registry.find(new SpecialNotFound())?.code).toBe('THING_GONE');
    expect(registry.find(new NotFound())?.code).toBe('THING_NOT_FOUND');
  });

  it.each([
    ['a blank message', { message: '  ', code: 'THING_NOT_FOUND' }],
    ['a blank code', { message: 'The thing does not exist.', code: '' }],
  ])('refuses a mapping with %s at boot', (_label, fields) => {
    expect(() =>
      new DomainErrorMappings().register([
        { error: NotFound, status: 404, ...fields },
      ]),
    ).toThrow('NotFound needs a fixed code and message');
  });

  it('collects the tables of every module and refuses a class mapped twice', () => {
    const registry = new DomainErrorMappings();
    registry.register([
      {
        error: NotFound,
        status: 404,
        code: 'THING_NOT_FOUND',
        message: 'The thing does not exist.',
      },
    ]);
    registry.register([
      { error: Unmapped, status: 409, code: 'OTHER', message: 'Other.' },
    ]);

    expect(registry.all().map((m) => m.code)).toEqual([
      'THING_NOT_FOUND',
      'OTHER',
    ]);
    expect(() =>
      registry.register([
        { error: NotFound, status: 400, code: 'AGAIN', message: 'Again.' },
      ]),
    ).toThrow('NotFound is already mapped');
  });
});
