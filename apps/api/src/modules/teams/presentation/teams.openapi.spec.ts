import { VersioningType } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { buildOpenApiDocument } from '../../../openapi/openapi-document';
import { TeamsController } from './teams.controller';

/** The schemas the generated client (orval, T-007-10) is built from. */
describe('Teams in the OpenAPI document', () => {
  async function document() {
    const moduleRef = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [
        { provide: CommandBus, useValue: {} },
        { provide: QueryBus, useValue: {} },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    return buildOpenApiDocument(app);
  }

  const json = (response: unknown) =>
    (response as { content: Record<string, { schema: unknown }> }).content[
      'application/json'
    ]?.schema;

  it('AC-02.1.1 POST /api/v1/teams documents the body and the 201 { data: TeamResponseDto }', async () => {
    const doc = await document();
    const post = doc.paths['/api/v1/teams']?.post;

    expect(post?.tags).toEqual(['Teams']);
    expect(JSON.stringify(post?.requestBody)).toContain(
      '#/components/schemas/CreateTeamDto',
    );
    expect(json(post?.responses['201'])).toEqual({
      type: 'object',
      required: ['data'],
      properties: { data: { $ref: '#/components/schemas/TeamResponseDto' } },
    });
    expect(doc.components?.schemas?.CreateTeamDto).toMatchObject({
      required: ['name', 'colorHex'],
    });
  });

  it('AC-02.2.1 GET /api/v1/teams documents the query and the { data: TeamResponseDto[], meta } page', async () => {
    const doc = await document();
    const get = doc.paths['/api/v1/teams']?.get;

    expect(
      get?.parameters?.map((p) => ('name' in p ? p.name : '')).sort(),
    ).toEqual(['limit', 'offset', 'search', 'sort']);
    expect(json(get?.responses['200'])).toMatchObject({
      required: ['data', 'meta'],
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/TeamResponseDto' },
        },
        meta: { $ref: '#/components/schemas/PageMeta' },
      },
    });
  });

  it('AC-02.5.1 GET /api/v1/teams/{id} documents the id and 200 { data: TeamResponseDto }', async () => {
    const doc = await document();
    const get = doc.paths['/api/v1/teams/{id}']?.get;

    expect(get?.parameters).toEqual([
      expect.objectContaining({ name: 'id', in: 'path', required: true }),
    ]);
    expect(json(get?.responses['200'])).toEqual({
      type: 'object',
      required: ['data'],
      properties: { data: { $ref: '#/components/schemas/TeamResponseDto' } },
    });
  });

  it('AC-02.6.1 PUT /api/v1/teams/{id} documents If-Match, the body and 200 { data: TeamResponseDto }', async () => {
    const doc = await document();
    const put = doc.paths['/api/v1/teams/{id}']?.put;

    expect(put?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'id', in: 'path' }),
        expect.objectContaining({
          name: 'If-Match',
          in: 'header',
          required: false,
        }),
      ]),
    );
    expect(JSON.stringify(put?.requestBody)).toContain(
      '#/components/schemas/ReplaceTeamDto',
    );
    expect(json(put?.responses['200'])).toMatchObject({
      properties: { data: { $ref: '#/components/schemas/TeamResponseDto' } },
    });
  });

  it('TeamResponseDto documents every response field', async () => {
    const doc = await document();

    expect(
      Object.keys(
        (doc.components?.schemas?.TeamResponseDto as { properties: object })
          .properties,
      ).sort(),
    ).toEqual([
      'colorHex',
      'createdAt',
      'description',
      'id',
      'name',
      'taskCount',
      'updatedAt',
      'version',
    ]);
  });
});
