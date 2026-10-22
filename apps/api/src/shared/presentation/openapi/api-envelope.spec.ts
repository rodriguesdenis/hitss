import { Controller, Get } from '@nestjs/common';
import {
  ApiProperty,
  DocumentBuilder,
  type ResponseObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { ApiOkEnvelope, ApiPageEnvelope } from './api-envelope';

class ItemDto {
  @ApiProperty() id!: string;
}

@Controller('probe')
class ProbeController {
  @Get('one')
  @ApiOkEnvelope(ItemDto)
  one() {
    return new ItemDto();
  }

  @Get('many')
  @ApiPageEnvelope(ItemDto)
  many() {
    return [];
  }
}

describe('OpenAPI envelope helpers', () => {
  async function documentOf() {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    const app = moduleRef.createNestApplication();
    return SwaggerModule.createDocument(app, new DocumentBuilder().build());
  }

  it('AC-01.5.4 ApiOkEnvelope documents { data: T } as the 200 response', async () => {
    const document = await documentOf();

    const schema = (
      document.paths['/probe/one']?.get?.responses['200'] as ResponseObject
    ).content?.['application/json']?.schema;
    expect(schema).toEqual({
      type: 'object',
      required: ['data'],
      properties: { data: { $ref: '#/components/schemas/ItemDto' } },
    });
  });

  it('AC-01.5.4 ApiPageEnvelope documents { data: T[], meta } with the page metadata', async () => {
    const document = await documentOf();

    const response = document.paths['/probe/many']?.get?.responses[
      '200'
    ] as ResponseObject;
    const schema = response.content?.['application/json']?.schema as {
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(schema.required).toEqual(['data', 'meta']);
    expect(schema.properties.data).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/ItemDto' },
    });
    expect(schema.properties.meta).toEqual({
      $ref: '#/components/schemas/PageMeta',
    });
    expect(document.components?.schemas?.PageMeta).toMatchObject({
      required: ['total', 'limit', 'offset', 'hasNextPage'],
    });
  });
});
