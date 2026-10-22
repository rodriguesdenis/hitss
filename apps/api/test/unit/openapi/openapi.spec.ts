import { Controller, Get, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { buildOpenApiDocument } from '../../../src/openapi/openapi-document';

@Controller({ path: 'health', version: '1' })
class HealthProbe {
  @Get('live')
  live() {
    return {};
  }
}

@Controller({ path: 'things', version: '1' })
class ThingsProbe {
  @Get()
  list() {
    return [];
  }
}

describe('OpenAPI document', () => {
  async function build() {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthProbe, ThingsProbe],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    return buildOpenApiDocument(app);
  }

  it('AC-08.2 declares the bearer scheme only: no session-cookie scheme for the API routes', async () => {
    const document = await build();

    expect(document.components?.securitySchemes).toEqual({
      bearer: expect.objectContaining({
        type: 'http',
        scheme: 'bearer',
      }) as object,
    });
  });

  it('AC-01.5.4 requires authentication globally but not on health', async () => {
    const document = await build();

    expect(document.security).toEqual([{ bearer: [] }]);
    const health = document.paths['/api/v1/health/live']?.get;
    expect(health?.security).toEqual([]);
    expect(document.paths['/api/v1/things']?.get?.security).toBeUndefined();
  });

  it('AC-01.8.1 documents the four auth routes under the Identity tag, without security', async () => {
    const document = await build();

    const routes = [
      ['/api/auth/sign-up/email', 'post'],
      ['/api/auth/sign-in/email', 'post'],
      ['/api/auth/sign-out', 'post'],
      ['/api/auth/get-session', 'get'],
    ] as const;
    for (const [path, method] of routes) {
      const operation = document.paths[path]?.[method];
      expect(operation?.tags).toEqual(['Identity']);
      expect(operation?.security).toEqual(
        path.endsWith('sign-out') || path.endsWith('get-session')
          ? [{ bearer: [] }]
          : [],
      );
    }
    expect(document.tags?.map((tag) => tag.name)).toContain('Identity');
  });

  it('AC-01.8.1 sign-in documents the set-auth-token response header the clients save', async () => {
    const document = await build();

    const ok =
      document.paths['/api/auth/sign-in/email']?.post?.responses['200'];
    expect(ok).toMatchObject({
      headers: { 'set-auth-token': { schema: { type: 'string' } } },
    });
  });
});
