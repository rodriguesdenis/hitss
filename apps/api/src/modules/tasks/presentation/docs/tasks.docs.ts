import { applyDecorators } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiPageEnvelope,
} from '../../../../shared/presentation/openapi/api-envelope';
import { ApiErrorResponses } from '../../../../shared/presentation/openapi/api-error';
import { TaskResponseDto } from '../dto/task-response.dto';

const NOT_FOUND =
  'TASK_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which).';
const PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE: the JSON body is over 100 kB.';
const TEAMS_RULES =
  'TOO_MANY_TEAMS (`details: { max, received }`, more than 10 distinct teams) or UNKNOWN_TEAMS (`details: { teamIds }`, the ids that are not your live teams).';

export const ApiTasks = () =>
  applyDecorators(ApiTags('Tasks'), ApiErrorResponses([401, 429]));

export const ApiCreateTask = () =>
  applyDecorators(
    ApiCreatedEnvelope(TaskResponseDto),
    ApiErrorResponses({
      400: 'VALIDATION_FAILED: an invalid or unknown field (teamIds malformed, duplicated or over 100 included); `details` names it.',
      413: PAYLOAD_TOO_LARGE,
      422: TEAMS_RULES,
    }),
  );

export const ApiListTasks = () =>
  applyDecorators(
    ApiPageEnvelope(TaskResponseDto),
    ApiErrorResponses({
      400: 'VALIDATION_FAILED: limit, offset, teamId, status, search, sort or an unknown parameter. A teamId that is not your live team is an empty page, not an error.',
    }),
  );

export const ApiGetTask = () =>
  applyDecorators(
    ApiOkEnvelope(TaskResponseDto),
    ApiErrorResponses({
      400: 'VALIDATION_FAILED: `id` is not a UUID.',
      404: NOT_FOUND,
    }),
  );

export const ApiChangeTaskStatus = () =>
  applyDecorators(
    ApiOkEnvelope(TaskResponseDto),
    ApiErrorResponses({
      400: 'VALIDATION_FAILED: `id` is not a UUID, `status` is missing or invalid, or another field is sent.',
      404: NOT_FOUND,
      413: PAYLOAD_TOO_LARGE,
    }),
  );

export const ApiReplaceTask = () =>
  applyDecorators(
    ApiOkEnvelope(TaskResponseDto),
    ApiErrorResponses({
      400: 'VALIDATION_FAILED: an invalid or unknown field, or `id` not a UUID; `details` names it.',
      404: 'TASK_NOT_FOUND: unknown, deleted, or owned by another user (never revealed which); wins over 422.',
      413: PAYLOAD_TOO_LARGE,
      422: TEAMS_RULES,
    }),
  );

export const ApiDeleteTask = () =>
  applyDecorators(
    ApiNoContentResponse({ description: 'The task was deleted.' }),
    ApiErrorResponses({
      400: 'VALIDATION_FAILED: `id` is not a UUID.',
      404: NOT_FOUND,
    }),
  );
