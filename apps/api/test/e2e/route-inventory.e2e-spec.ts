import { INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { PUBLIC_ROUTE } from '../../src/shared/presentation/decorators/public.decorator';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';
import { OwnerProbeModule } from './owner-probe.module';

/**
 * The only public Nest routes (AC-01.5.4). `/api/auth/*` is served by Better Auth outside Nest
 * routing; the API docs join this list when DOCS_ENABLED gets its route.
 */
const PUBLIC_ALLOWLIST = [
  'GET /api/v1/health/live',
  'GET /api/v1/health/ready',
];

const SAMPLE_UUID = '7d0c5e2a-3f1b-4c8e-9a6d-2b4f8e1c0a93';

interface Route {
  method: string;
  path: string;
  isPublic: boolean;
}

/** Every handler of the app with its HTTP method, full path and public flag. */
function routesOf(app: INestApplication): Route[] {
  const discovery = app.get(DiscoveryService);
  const scanner = app.get(MetadataScanner);
  const reflector = app.get(Reflector);
  const join = (...parts: string[]) =>
    `/${parts
      .flatMap((part) => part.split('/'))
      .filter(Boolean)
      .join('/')}`;

  return discovery.getControllers().flatMap(({ metatype, instance }) => {
    if (!metatype || !instance) {
      return [];
    }
    const controllerPath = String(
      Reflect.getMetadata(PATH_METADATA, metatype) ?? '',
    );
    const prototype = Object.getPrototypeOf(instance) as object;
    return scanner.getAllMethodNames(prototype).flatMap((name) => {
      const handler = Object.getOwnPropertyDescriptor(prototype, name)
        ?.value as (() => unknown) | undefined;
      if (
        !handler ||
        Reflect.getMetadata(PATH_METADATA, handler) === undefined
      ) {
        return [];
      }
      const method = String(
        RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number],
      );
      const path = join(
        'api',
        'v1',
        controllerPath,
        String(Reflect.getMetadata(PATH_METADATA, handler)),
      );
      const isPublic =
        reflector.getAllAndOverride<boolean | undefined>(PUBLIC_ROUTE, [
          handler,
          metatype,
        ]) === true;
      return [{ method, path, isPublic }];
    });
  });
}

describe('route inventory: every route is private unless allowlisted (e2e)', () => {
  const db = useTestDatabase();

  describe('the production app', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createTestApp(db.url);
    });

    afterAll(() => app.close());

    it('AC-01.5.4 the public routes are exactly the allowlist', () => {
      const routes = routesOf(app);

      expect(routes.length).toBeGreaterThan(0);
      expect(
        routes
          .filter((route) => route.isPublic)
          .map((route) => `${route.method} ${route.path}`)
          .sort(),
      ).toEqual([...PUBLIC_ALLOWLIST].sort());
    });
  });

  describe('with private routes mounted', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createTestApp(db.url, { imports: [OwnerProbeModule] });
    });

    afterAll(() => app.close());

    it('AC-01.5.1 AC-01.5.4 every route outside the allowlist answers an anonymous call with 401', async () => {
      const privateRoutes = routesOf(app).filter((route) => !route.isPublic);
      expect(privateRoutes.length).toBeGreaterThan(0);

      for (const { method, path } of privateRoutes) {
        const url = path.replace(/:[^/]+/g, SAMPLE_UUID);
        const call = request(app.getHttpServer() as App)[
          method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete'
        ](url);

        const response = await call.send({});

        expect({ route: `${method} ${path}`, status: response.status }).toEqual(
          {
            route: `${method} ${path}`,
            status: 401,
          },
        );
      }
    });
  });
});
