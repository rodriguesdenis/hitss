import { VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { buildOpenApiDocument } from '../../../../../../openapi/openapi-document';
import { openApiProblems } from '../../../../../../openapi/openapi-structure';
import { CreateTeamUseCase } from '../../../../application/use-cases/create-team.use-case';
import { DeleteTeamUseCase } from '../../../../application/use-cases/delete-team.use-case';
import { GetTeamUseCase } from '../../../../application/use-cases/get-team.use-case';
import { ListTeamsUseCase } from '../../../../application/use-cases/list-teams.use-case';
import { UpdateTeamUseCase } from '../../../../application/use-cases/update-team.use-case';
import { TeamsController } from '../../../../presentation/http/teams.controller';

/** The schemas the generated client (orval, T-007-10) is built from. */
describe('Teams in the OpenAPI document', () => {
  async function document() {
    const moduleRef = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [
        CreateTeamUseCase,
        UpdateTeamUseCase,
        DeleteTeamUseCase,
        GetTeamUseCase,
        ListTeamsUseCase,
      ].map((useCase) => ({ provide: useCase, useValue: {} })),
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

  it('AC-02.6.1 AC-08.3 PUT /api/v1/teams/{id} documents the id, the body and 200 { data: TeamResponseDto }, and no If-Match', async () => {
    const doc = await document();
    const put = doc.paths['/api/v1/teams/{id}']?.put;

    expect(put?.parameters).toEqual([
      expect.objectContaining({ name: 'id', in: 'path' }),
    ]);
    expect(JSON.stringify(put?.requestBody)).toContain(
      '#/components/schemas/UpdateTeamDto',
    );
    expect(json(put?.responses['200'])).toMatchObject({
      properties: { data: { $ref: '#/components/schemas/TeamResponseDto' } },
    });
  });

  it.each([
    ['get', '/api/v1/teams', ['400', '401', '429']],
    ['get', '/api/v1/teams/{id}', ['400', '401', '404', '429']],
    ['post', '/api/v1/teams', ['400', '401', '409', '413', '429']],
    ['put', '/api/v1/teams/{id}', ['400', '401', '404', '409', '413', '429']],
    ['delete', '/api/v1/teams/{id}', ['400', '401', '404', '429']],
  ] as const)(
    'AC-02.11.2 %s %s documents its error responses %j with the shared { error } schema',
    async (method, path, statuses) => {
      const doc = await document();
      const responses = doc.paths[path]?.[method]?.responses ?? {};

      const errors = Object.keys(responses).filter((status) =>
        /^[45]/.test(status),
      );
      expect(errors.sort()).toEqual([...statuses]);
      for (const status of statuses) {
        expect(json(responses[status])).toEqual({
          $ref: '#/components/schemas/ApiErrorResponseDto',
        });
      }
    },
  );

  it('the teams document is structurally valid', async () => {
    expect(openApiProblems(await document())).toEqual([]);
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
