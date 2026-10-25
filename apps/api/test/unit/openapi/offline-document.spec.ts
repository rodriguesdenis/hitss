import { buildOfflineOpenApiDocument } from '../../../src/openapi/offline-document';

describe('Offline OpenAPI document', () => {
  it('AC-07.8.3 builds the full contract from the real module graph with no database', async () => {
    const document = await buildOfflineOpenApiDocument();

    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/teams',
        '/api/v1/tasks/{id}/status',
        '/api/auth/sign-in/email',
      ]),
    );
    expect(document.paths['/api/v1/teams']?.get?.operationId).toBe('teamsList');
  });

  it('AC-07.8.1 sorts every object key so the committed contract diffs stably', async () => {
    const document = await buildOfflineOpenApiDocument();

    const keys = Object.keys(document.paths);
    expect(keys).toEqual([...keys].sort());
    const schemas = Object.keys(document.components?.schemas ?? {});
    expect(schemas).toEqual([...schemas].sort());
  });
});
