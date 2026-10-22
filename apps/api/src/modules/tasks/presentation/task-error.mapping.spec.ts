import { DomainErrorMappings } from '../../../shared/presentation/filters/domain-error-mappings';
import { TaskNotFound } from '../domain/task.errors';
import { TASK_ERROR_MAPPINGS } from './task-error.mapping';

describe('TASK_ERROR_MAPPINGS', () => {
  it('AC-03.8.2 maps TaskNotFound to 404 TASK_NOT_FOUND without details', () => {
    const registry = new DomainErrorMappings();
    registry.register(TASK_ERROR_MAPPINGS);

    const mapping = registry.find(new TaskNotFound());

    expect(mapping).toMatchObject({ status: 404, code: 'TASK_NOT_FOUND' });
    expect(mapping?.details).toBeUndefined();
  });
});
