import type { OpenAPIObject } from '@nestjs/swagger';
import { openApiProblems } from './openapi-structure';

const ERROR = { $ref: '#/components/schemas/ApiErrorResponseDto' };
const json = (schema: unknown) => ({
  content: { 'application/json': { schema } },
});

const valid = (): OpenAPIObject =>
  ({
    openapi: '3.0.0',
    info: { title: 'API', version: '1.0' },
    paths: {
      '/teams/{id}': {
        get: {
          operationId: 'getTeam',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': json({ $ref: '#/components/schemas/Team' }),
            '404': json(ERROR),
          },
        },
      },
      '/auth/sign-in': {
        post: {
          tags: ['Identity'],
          responses: { '200': {}, '401': json({ type: 'object' }) },
        },
      },
    },
    components: {
      schemas: {
        Team: { type: 'object' },
        ApiErrorResponseDto: { type: 'object' },
      },
    },
  }) as unknown as OpenAPIObject;

describe('openApiProblems', () => {
  it('AC-01.5.4 accepts a well-formed document (Identity keeps its native errors)', () => {
    expect(openApiProblems(valid(), ['Identity'])).toEqual([]);
  });

  it('reports an unresolved $ref', () => {
    const document = valid();
    (document.components!.schemas as Record<string, unknown>).Team = undefined;

    expect(openApiProblems(document, ['Identity'])).toEqual([
      expect.stringContaining('unresolved $ref #/components/schemas/Team'),
    ]);
  });

  it('reports a path parameter missing from the operation, and one that is not required', () => {
    const document = valid();
    const get = (
      document.paths['/teams/{id}'] as Record<string, Record<string, unknown>>
    ).get!;
    get.parameters = [];
    expect(openApiProblems(document, ['Identity'])).toEqual([
      'GET /teams/{id}: path parameter {id} is not declared',
    ]);

    get.parameters = [{ name: 'id', in: 'path', required: false }];
    expect(openApiProblems(document, ['Identity'])).toEqual([
      'GET /teams/{id}: path parameter id must be required',
    ]);
  });

  it('reports duplicate operationIds, a missing 2xx and an error without the shared schema', () => {
    const document = valid();
    document.paths['/teams'] = {
      post: {
        operationId: 'getTeam',
        responses: { '409': json({ type: 'object' }) },
      },
    } as never;

    expect(openApiProblems(document, ['Identity'])).toEqual([
      'POST /teams: operationId getTeam already used by GET /teams/{id}',
      'POST /teams: no 2xx response',
      'POST /teams: 409 does not use the shared { error } schema',
    ]);
  });

  it('reports a non-3.x document', () => {
    expect(
      openApiProblems({ ...valid(), openapi: '2.0' }, ['Identity']),
    ).toEqual(['openapi version 2.0 is not 3.x']);
  });
});
