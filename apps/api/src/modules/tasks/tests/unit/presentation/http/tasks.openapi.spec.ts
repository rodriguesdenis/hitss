import { VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { buildOpenApiDocument } from '../../../../../../openapi/openapi-document';
import { openApiProblems } from '../../../../../../openapi/openapi-structure';
import { ChangeTaskStatusUseCase } from '../../../../application/use-cases/change-task-status.use-case';
import { CreateTaskUseCase } from '../../../../application/use-cases/create-task.use-case';
import { DeleteTaskUseCase } from '../../../../application/use-cases/delete-task.use-case';
import { GetTaskUseCase } from '../../../../application/use-cases/get-task.use-case';
import { ListTasksUseCase } from '../../../../application/use-cases/list-tasks.use-case';
import { UpdateTaskUseCase } from '../../../../application/use-cases/update-task.use-case';
import { TasksController } from '../../../../presentation/http/tasks.controller';

describe('Tasks in the OpenAPI document', () => {
  async function document() {
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        CreateTaskUseCase,
        UpdateTaskUseCase,
        ChangeTaskStatusUseCase,
        DeleteTaskUseCase,
        GetTaskUseCase,
        ListTasksUseCase,
      ].map((useCase) => ({ provide: useCase, useValue: {} })),
    }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    return buildOpenApiDocument(app);
  }

  type Response = {
    content?: Record<string, { schema: unknown }>;
    headers?: object;
  };
  const json = (response: unknown) =>
    (response as Response).content?.['application/json']?.schema;
  const data = (ref: string) => ({
    type: 'object',
    required: ['data'],
    properties: { data: { $ref: `#/components/schemas/${ref}` } },
  });

  it.each([
    ['post', '/api/v1/tasks', '201', ['400', '401', '413', '422', '429']],
    ['get', '/api/v1/tasks', '200', ['400', '401', '429']],
    ['get', '/api/v1/tasks/{id}', '200', ['400', '401', '404', '429']],
    [
      'put',
      '/api/v1/tasks/{id}',
      '200',
      ['400', '401', '404', '413', '422', '429'],
    ],
    [
      'patch',
      '/api/v1/tasks/{id}/status',
      '200',
      ['400', '401', '404', '413', '429'],
    ],
    ['delete', '/api/v1/tasks/{id}', '204', ['400', '401', '404', '429']],
  ] as const)(
    'AC-03.1.1 %s %s documents its %s and exactly the error responses %j with the shared { error } schema',
    async (method, path, success, errors) => {
      const doc = await document();
      const operation = doc.paths[path]?.[method];
      const responses = operation?.responses ?? {};

      expect(operation?.tags).toEqual(['Tasks']);
      expect(Object.keys(responses)).toContain(success);
      expect(
        Object.keys(responses)
          .filter((status) => /^[45]/.test(status))
          .sort(),
      ).toEqual([...errors]);
      for (const status of errors) {
        expect(json(responses[status])).toEqual({
          $ref: '#/components/schemas/ApiErrorResponseDto',
        });
      }
    },
  );

  it('AC-03.1.1 single-task responses use the { data: TaskResponseDto } envelope', async () => {
    const doc = await document();

    expect(json(doc.paths['/api/v1/tasks']?.post?.responses['201'])).toEqual(
      data('TaskResponseDto'),
    );
    for (const path of ['/api/v1/tasks/{id}', '/api/v1/tasks/{id}/status']) {
      const item = doc.paths[path];
      for (const operation of [item?.get, item?.put, item?.patch].filter(
        Boolean,
      )) {
        expect(json(operation?.responses['200'])).toEqual(
          data('TaskResponseDto'),
        );
      }
    }
  });

  it('AC-03.2.1 GET /api/v1/tasks documents its query parameters and the page envelope', async () => {
    const doc = await document();
    const list = doc.paths['/api/v1/tasks']?.get;

    expect(
      list?.parameters?.map((p) => ('name' in p ? p.name : '')).sort(),
    ).toEqual(['limit', 'offset', 'search', 'sort', 'status', 'teamId']);
    expect(json(list?.responses['200'])).toMatchObject({
      required: ['data', 'meta'],
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/TaskResponseDto' },
        },
        meta: { $ref: '#/components/schemas/PageMeta' },
      },
    });
  });

  it('429 documents Retry-After, and the error details cover the 422 shapes', async () => {
    const doc = await document();
    const tooMany = doc.paths['/api/v1/tasks']?.post?.responses[
      '429'
    ] as Response;

    expect(tooMany.headers).toHaveProperty('Retry-After');
    const details = JSON.stringify(
      (doc.components?.schemas?.ApiErrorBodyDto as { properties: object })
        .properties,
    );
    expect(details).toContain('received');
    expect(details).toContain('teamIds');
  });

  it('the tasks document is structurally valid, and the bodies are documented', async () => {
    const doc = await document();

    expect(openApiProblems(doc)).toEqual([]);
    for (const dto of [
      'CreateTaskDto',
      'UpdateTaskDto',
      'ChangeTaskStatusDto',
    ]) {
      expect(doc.components?.schemas?.[dto]).toHaveProperty('properties');
    }
  });
});
