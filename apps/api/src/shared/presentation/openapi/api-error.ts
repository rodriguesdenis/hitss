import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';

/** One validation problem (`400 VALIDATION_FAILED`). */
export class ApiValidationDetailDto {
  @ApiProperty({ example: 'name' }) field!: string;
  @ApiProperty({ example: 'name must be 2 to 50 characters' }) message!: string;
}

/** The `error` object of every error response (ADR-0005, api-contracts → Errors). */
export class ApiErrorBodyDto {
  @ApiProperty({
    description: 'Stable, machine-readable code',
    example: 'TEAM_NOT_FOUND',
  })
  code!: string;

  @ApiProperty({
    description: 'Fixed, human-readable text; never echoes input',
    example: 'Team not found.',
  })
  message!: string;

  @ApiPropertyOptional({
    description:
      'Validation problems (400); `{ max, received }` on 422 TOO_MANY_TEAMS; `{ teamIds }` on 422 UNKNOWN_TEAMS.',
    oneOf: [
      { type: 'array', items: { $ref: getSchemaPath(ApiValidationDetailDto) } },
      {
        type: 'object',
        properties: {
          max: { type: 'integer', example: 10 },
          received: { type: 'integer', example: 12 },
        },
      },
      {
        type: 'object',
        properties: {
          teamIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        },
      },
    ],
  })
  details?: ApiValidationDetailDto[] | Record<string, unknown>;

  @ApiProperty({ description: 'Trace id to quote when reporting the error' })
  traceId!: string;
}

/** `{ error }`: the body of every 4xx and 5xx response. */
export class ApiErrorResponseDto {
  @ApiProperty({ type: ApiErrorBodyDto }) error!: ApiErrorBodyDto;
}

/** Default descriptions, by status, naming the contract codes (api-contracts → Error codes). */
const DEFAULT_DESCRIPTIONS: Readonly<Record<number, string>> = {
  400: 'VALIDATION_FAILED: the request is invalid; `details` names each field.',
  401: 'UNAUTHENTICATED: no valid session (bearer token or session cookie).',
  404: 'Not found: unknown, deleted, or owned by another user (never revealed which).',
  409: 'Conflict with the current state.',
  413: 'PAYLOAD_TOO_LARGE: the JSON body is over 100 kB.',
  422: 'The request is well formed but cannot be applied.',
  429: 'RATE_LIMITED: too many requests; retry after `Retry-After` seconds.',
};

/** Documented on 429: when the client may retry. */
const RETRY_AFTER = {
  'Retry-After': {
    description: 'Seconds to wait before retrying.',
    schema: { type: 'integer', example: 30 },
  },
};

const isStatusList = (
  value: readonly number[] | Readonly<Record<number, string>>,
): value is readonly number[] => Array.isArray(value);

/**
 * Documents error responses with the shared `{ error }` schema. Pass the statuses, or a map of
 * status → description when a route needs a more precise one (e.g. 409 TEAM_NAME_ALREADY_EXISTS).
 */
export function ApiErrorResponses(
  statuses: readonly number[] | Readonly<Record<number, string>>,
) {
  const entries: [number, string][] = isStatusList(statuses)
    ? statuses.map((status) => [
        status,
        DEFAULT_DESCRIPTIONS[status] ?? 'Error.',
      ])
    : Object.entries(statuses).map(([status, description]) => [
        Number(status),
        description,
      ]);
  return applyDecorators(
    ApiExtraModels(
      ApiErrorResponseDto,
      ApiErrorBodyDto,
      ApiValidationDetailDto,
    ),
    ...entries.map(([status, description]) =>
      ApiResponse({
        status,
        description,
        schema: { $ref: getSchemaPath(ApiErrorResponseDto) },
        ...(status === 429 ? { headers: RETRY_AFTER } : {}),
      }),
    ),
  );
}
