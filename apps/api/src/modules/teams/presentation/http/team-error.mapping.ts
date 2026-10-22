import { ErrorCode } from '../../../../shared/presentation/filters/error-codes';
import type { DomainErrorMapping } from '../../../../shared/presentation/filters/domain-error-mappings';
import {
  InvalidColorHex,
  InvalidTeamDescription,
  InvalidTeamName,
  TeamNameAlreadyExists,
  TeamNotFound,
} from '../../domain/errors/team.errors';

const invalid = (
  error:
    | typeof InvalidTeamName
    | typeof InvalidColorHex
    | typeof InvalidTeamDescription,
  field: string,
  message: string,
): DomainErrorMapping => ({
  error,
  status: 400,
  code: ErrorCode.VALIDATION_FAILED,
  message: 'Request validation failed.',
  details: () => [{ field, message }],
});

export const TEAM_ERROR_MAPPINGS: readonly DomainErrorMapping[] = [
  invalid(
    InvalidTeamName,
    'name',
    'name must be 2 to 50 characters with no control characters',
  ),
  invalid(InvalidColorHex, 'colorHex', 'colorHex must be a #RRGGBB hex color'),
  invalid(
    InvalidTeamDescription,
    'description',
    'description must be at most 280 characters with no control characters other than line breaks',
  ),
  {
    error: TeamNotFound,
    status: 404,
    code: 'TEAM_NOT_FOUND',
    message: 'Team not found.',
  },
  {
    error: TeamNameAlreadyExists,
    status: 409,
    code: 'TEAM_NAME_ALREADY_EXISTS',
    message: 'A team with this name already exists.',
  },
];
