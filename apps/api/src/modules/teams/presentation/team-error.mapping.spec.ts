import { DomainErrorMappings } from '../../../shared/presentation/filters/domain-error-mappings';
import {
  InvalidColorHex,
  InvalidTeamDescription,
  InvalidTeamName,
  TeamNameAlreadyExists,
  TeamNotFound,
} from '../domain/team.errors';
import { TEAM_ERROR_MAPPINGS } from './team-error.mapping';

describe('TEAM_ERROR_MAPPINGS', () => {
  const registry = new DomainErrorMappings();
  registry.register(TEAM_ERROR_MAPPINGS);

  it.each([
    [new InvalidTeamName(), 'name'],
    [new InvalidColorHex(), 'colorHex'],
    [new InvalidTeamDescription(), 'description'],
  ])('maps %p to 400 VALIDATION_FAILED naming its field', (error, field) => {
    const mapping = registry.find(error);

    expect(mapping).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(mapping?.details?.(error)).toEqual([
      { field, message: expect.any(String) as string },
    ]);
  });

  it('AC-02.1.5 maps TeamNameAlreadyExists to 409 TEAM_NAME_ALREADY_EXISTS without details', () => {
    const mapping = registry.find(new TeamNameAlreadyExists());

    expect(mapping).toMatchObject({
      status: 409,
      code: 'TEAM_NAME_ALREADY_EXISTS',
    });
    expect(mapping?.details).toBeUndefined();
  });

  it('maps TeamNotFound to 404 TEAM_NOT_FOUND', () => {
    expect(registry.find(new TeamNotFound())).toMatchObject({
      status: 404,
      code: 'TEAM_NOT_FOUND',
    });
  });
});
