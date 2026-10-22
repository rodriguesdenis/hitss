import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiProperty,
  getSchemaPath,
} from '@nestjs/swagger';

export class PageMeta {
  @ApiProperty({ example: 42 }) total!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ example: 0 }) offset!: number;
  @ApiProperty({ example: true }) hasNextPage!: boolean;
}

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

export function ApiCreatedEnvelope<T extends Type>(model: T) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiCreatedResponse({
      schema: {
        type: 'object',
        required: ['data'],
        properties: { data: { $ref: getSchemaPath(model) } },
      },
    }),
  );
}

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
