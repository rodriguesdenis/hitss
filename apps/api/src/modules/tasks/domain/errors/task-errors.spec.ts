import { DomainError } from '../../../../shared/domain/domain-error';
import { TaskNotFound } from './task-not-found.error';
import { UnknownTeams } from './unknown-teams.error';

describe('Task errors', () => {
  it('TaskNotFound does not echo the id', () => {
    const error = new TaskNotFound();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('TaskNotFound');
    expect(error.message).toBe('Task not found.');
  });

  it('AC-03.1.6 UnknownTeams lists exactly the offending ids', () => {
    const ids = ['x', 'design'];
    const error = new UnknownTeams(ids);
    ids.push('mobile');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.teamIds).toEqual(['x', 'design']);
    expect(error.message).toBe('Some teams do not exist.');
  });
});
