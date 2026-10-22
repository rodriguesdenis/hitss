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
      'Validation problems (400), or `{ currentVersion }` on 412 PRECONDITION_FAILED.',
    oneOf: [
      { type: 'array', items: { $ref: getSchemaPath(ApiValidationDetailDto) } },
      {
        type: 'object',
        properties: { currentVersion: { type: 'integer', example: 2 } },
      },
    ],
  })
  details?: ApiValidationDetailDto[] | { currentVersion: number };

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
  403: 'CSRF_REJECTED: a cookie-authenticated request from an untrusted origin.',
  404: 'Not found: unknown, deleted, or owned by another user (never revealed which).',
  409: 'Conflict with the current state.',
  412: 'PRECONDITION_FAILED: If-Match does not match the current version; `details.currentVersion`.',
  415: 'UNSUPPORTED_MEDIA_TYPE: the body must be application/json.',
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
      }),
    ),
  );
}
