import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';

describe('API documentation (e2e, T-001-13)', () => {
  const db = useTestDatabase();
  let enabled: INestApplication;
  let disabled: INestApplication;

  beforeAll(async () => {
    enabled = await createTestApp(db.url, { config: { docsEnabled: true } });
    disabled = await createTestApp(db.url, { config: { docsEnabled: false } });
  });

  afterAll(async () => {
    await enabled?.close();
    await disabled?.close();
  });

  const http = (app: INestApplication) => request(app.getHttpServer() as App);

  it('AC-01.5.4 /docs and /docs/openapi.json are public while DOCS_ENABLED', async () => {
    const page = await http(enabled).get('/docs/');
    const json = await http(enabled).get('/docs/openapi.json');

    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(json.status).toBe(200);
    expect(json.headers['content-type']).toContain('application/json');
  });

  it('AC-01.5.4 the OpenAPI document lists the security schemes, and health has none', async () => {
    const response = await http(enabled).get('/docs/openapi.json');

    const document = response.body as {
      components: { securitySchemes: Record<string, unknown> };
      security: unknown[];
      paths: Record<string, Record<string, { security?: unknown[] }>>;
    };
    expect(Object.keys(document.components.securitySchemes)).toEqual(
      expect.arrayContaining(['bearer', 'session-cookie']),
    );
    expect(document.security).toHaveLength(2);
    expect(document.paths['/api/v1/health/live']?.get?.security).toEqual([]);
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/api/auth/sign-in/email',
        '/api/auth/get-session',
      ]),
    );
  });

  it('AC-01.8.6 DOCS_ENABLED=false (or production) answers 404 for /docs and /docs/openapi.json', async () => {
    for (const path of ['/docs', '/docs/', '/docs/openapi.json']) {
      const response = await http(disabled).get(path);
      expect(response.status).toBe(404);
    }
  });
});
