import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiProperty,
  getSchemaPath,
} from '@nestjs/swagger';

/** `meta` of a list response (ADR-0006). */
export class PageMeta {
  @ApiProperty({ example: 42 }) total!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ example: 0 }) offset!: number;
  @ApiProperty({ example: true }) hasNextPage!: boolean;
}

/** Documents the `200 { data: T }` success envelope of a handler (ADR-0005). */
export function ApiOkEnvelope<T extends Type>(model: T) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        type: 'object',
        required: ['data'],
        properties: { data: { $ref: getSchemaPath(model) } },
      },
    }),
  );
}

/** Documents the `200 { data: T[], meta }` list envelope of a handler (ADR-0005, ADR-0006). */
export function ApiPageEnvelope<T extends Type>(model: T) {
  return applyDecorators(
    ApiExtraModels(model, PageMeta),
    ApiOkResponse({
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(PageMeta) },
        },
      },
    }),
  );
}
