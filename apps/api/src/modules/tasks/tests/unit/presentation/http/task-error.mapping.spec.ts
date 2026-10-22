import { DomainErrorMappings } from '../../../../../../shared/presentation/filters/domain-error-mappings';
import {
  InvalidDueDate,
  InvalidTaskDescription,
  InvalidTaskStatus,
  InvalidTaskTitle,
  TaskNotFound,
  TooManyTeams,
  UnknownTeams,
} from '../../../../domain/errors/task.errors';
import { TASK_ERROR_MAPPINGS } from '../../../../presentation/http/task-error.mapping';

describe('TASK_ERROR_MAPPINGS', () => {
  const registry = new DomainErrorMappings();
  registry.register(TASK_ERROR_MAPPINGS);

  it.each([
    [new InvalidTaskTitle(), 'title'],
    [new InvalidTaskDescription(), 'description'],
    [new InvalidTaskStatus(), 'status'],
    [new InvalidDueDate(), 'dueDate'],
  ])('maps %p to 400 VALIDATION_FAILED naming its field', (error, field) => {
    const mapping = registry.find(error);

    expect(mapping).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(mapping?.details?.(error)).toEqual([
      { field, message: expect.any(String) as string },
    ]);
  });

  it('AC-03.8.2 maps TaskNotFound to 404 TASK_NOT_FOUND without details', () => {
    const mapping = registry.find(new TaskNotFound());

    expect(mapping).toMatchObject({ status: 404, code: 'TASK_NOT_FOUND' });
    expect(mapping?.details).toBeUndefined();
  });

  it('AC-03.1.6 maps TooManyTeams to 422 TOO_MANY_TEAMS with max and received', () => {
    const error = new TooManyTeams(10, 11);
    const mapping = registry.find(error);

    expect(mapping).toMatchObject({ status: 422, code: 'TOO_MANY_TEAMS' });
    expect(mapping?.details?.(error)).toEqual({ max: 10, received: 11 });
  });

  it('AC-03.1.6 maps UnknownTeams to 422 UNKNOWN_TEAMS with exactly its ids', () => {
    const error = new UnknownTeams(['a', 'b']);
    const mapping = registry.find(error);

    expect(mapping).toMatchObject({ status: 422, code: 'UNKNOWN_TEAMS' });
    expect(mapping?.details?.(error)).toEqual({ teamIds: ['a', 'b'] });
  });
});
