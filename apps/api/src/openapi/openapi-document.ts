import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { AUTH_PATHS, IDENTITY_TAG } from './auth-paths';

export const DOCS_PATH = 'docs';
export const OPENAPI_JSON_PATH = 'docs/openapi.json';

/** Routes that need no session: the health probes. */
const PUBLIC_PATH_PREFIXES = ['/api/v1/health'];

/**
 * The OpenAPI 3 document of the app (ADR-0005): the controllers' DTOs, the hand-written Better
 * Auth routes under the `Identity` tag, `bearer` security on every operation
 * except health and sign-up/sign-in.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Teams & Tasks API')
      .setDescription(
        'Teams and tasks REST API. Sign in at `/api/auth/sign-in/email`, then send the returned token as `Authorization: Bearer <token>` (the API routes accept no session cookie).',
      )
      .setVersion('1.0')
      .addBearerAuth(undefined, 'bearer')
      .addSecurityRequirements('bearer')
      .addTag(
        IDENTITY_TAG,
        'Email and password sign-up, sign-in and sessions (Better Auth)',
      )
      .build(),
  );

  for (const [path, item] of Object.entries(document.paths)) {
    if (PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      for (const operation of Object.values(item)) {
        if (operation && typeof operation === 'object') {
          (operation as { security?: unknown[] }).security = [];
        }
      }
    }
  }
  document.paths = { ...document.paths, ...AUTH_PATHS };
  return document;
}

/** Serves `/docs` and `/docs/openapi.json` (outside the `/api` prefix and the auth guard). */
export function setupDocs(app: INestApplication): void {
  SwaggerModule.setup(DOCS_PATH, app, buildOpenApiDocument(app), {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
  });
}
