import { httpErrorOf } from '@test/support/http-error';
import {
  InvalidColorHex,
  InvalidTeamDescription,
  InvalidTeamName,
  TeamNameAlreadyExists,
  TeamNotFound,
} from '../../../../domain/errors/team.errors';

describe('Team errors over HTTP', () => {
  it.each([
    [
      new InvalidTeamName(),
      'name',
      'name must be 2 to 50 characters with no control characters',
    ],
    [new InvalidColorHex(), 'colorHex', 'colorHex must be a #RRGGBB hex color'],
    [
      new InvalidTeamDescription(),
      'description',
      'description must be at most 280 characters with no control characters other than line breaks',
    ],
  ])(
    'AC-09.6 %p → 400 VALIDATION_FAILED naming its field',
    (error, field, message) => {
      expect(httpErrorOf(error)).toEqual({
        status: 400,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed.',
          details: [{ field, message }],
        },
      });
    },
  );

  it('AC-02.1.5 AC-09.6 TeamNameAlreadyExists → 409 TEAM_NAME_ALREADY_EXISTS without details', () => {
    expect(httpErrorOf(new TeamNameAlreadyExists())).toEqual({
      status: 409,
      error: {
        code: 'TEAM_NAME_ALREADY_EXISTS',
        message: 'A team with this name already exists.',
      },
    });
  });

  it('AC-09.6 TeamNotFound → 404 TEAM_NOT_FOUND', () => {
    expect(httpErrorOf(new TeamNotFound())).toEqual({
      status: 404,
      error: { code: 'TEAM_NOT_FOUND', message: 'Team not found.' },
    });
  });
});
