import { ConcurrencyConflict } from '../../domain/domain-error';
import { DomainErrorMappings } from './domain-error-mappings';
import { SHARED_ERROR_MAPPINGS } from './shared-error.mapping';

describe('SHARED_ERROR_MAPPINGS', () => {
  it('AC-02.9.2 maps ConcurrencyConflict to 412 PRECONDITION_FAILED with the current version', () => {
    const registry = new DomainErrorMappings();
    registry.register(SHARED_ERROR_MAPPINGS);
    const error = new ConcurrencyConflict(4);

    const mapping = registry.find(error);

    expect(mapping).toMatchObject({ status: 412, code: 'PRECONDITION_FAILED' });
    expect(mapping?.message).not.toContain('4');
    expect(mapping?.details?.(error)).toEqual({ currentVersion: 4 });
  });
});
