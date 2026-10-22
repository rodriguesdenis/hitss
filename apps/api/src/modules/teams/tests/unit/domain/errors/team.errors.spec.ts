import { DomainError } from '../../../../../../shared/domain/domain-error';
import {
  TeamNameAlreadyExists,
  TeamNotFound,
} from '../../../../domain/errors/team.errors';

describe('Team errors', () => {
  it('AC-02.6.6 TeamNotFound is a domain error that does not echo the id', () => {
    const error = new TeamNotFound();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('TeamNotFound');
    expect(error.message).toBe('Team not found.');
  });

  it('AC-02.1.5 TeamNameAlreadyExists is a domain error that does not echo the name', () => {
    const error = new TeamNameAlreadyExists();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('TeamNameAlreadyExists');
    expect(error.message).toBe('A team with this name already exists.');
  });
});
