import { applyDecorators } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiPageEnvelope,
} from '../../../../shared/presentation/openapi/api-envelope';
import { ApiErrorResponses } from '../../../../shared/presentation/openapi/api-error';
import { TeamResponseDto } from '../dto/team-response.dto';

const NOT_FOUND =
  'TEAM_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which).';
const NAME_TAKEN =
  'TEAM_NAME_ALREADY_EXISTS: you already have an active team with this name (any letter case).';
const PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE: the JSON body is over 100 kB.';

export const ApiTeams = () =>
  applyDecorators(ApiTags('Teams'), ApiErrorResponses([401, 429]));

export const ApiListTeams = () =>
  applyDecorators(ApiPageEnvelope(TeamResponseDto), ApiErrorResponses([400]));

export const ApiGetTeam = () =>
  applyDecorators(
    ApiOkEnvelope(TeamResponseDto),
    ApiErrorResponses({
      400: 'VALIDATION_FAILED: `id` is not a UUID.',
      404: NOT_FOUND,
    }),
  );

export const ApiCreateTeam = () =>
  applyDecorators(
    ApiCreatedEnvelope(TeamResponseDto),
    ApiErrorResponses({
      400: 'VALIDATION_FAILED: an invalid or unknown field; `details` names it.',
      409: NAME_TAKEN,
      413: PAYLOAD_TOO_LARGE,
    }),
  );

export const ApiReplaceTeam = () =>
  applyDecorators(
    ApiOkEnvelope(TeamResponseDto),
    ApiErrorResponses({
      400: 'VALIDATION_FAILED: an invalid or unknown field, or `id` not a UUID.',
      404: NOT_FOUND,
      409: NAME_TAKEN,
      413: PAYLOAD_TOO_LARGE,
    }),
  );

export const ApiDeleteTeam = () =>
  applyDecorators(
    ApiNoContentResponse({ description: 'The team was deleted.' }),
    ApiErrorResponses({
      400: 'VALIDATION_FAILED: `id` is not a UUID.',
      404: NOT_FOUND,
    }),
  );
