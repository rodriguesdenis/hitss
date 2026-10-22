import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key of a public route. It is the key the global Better Auth guard
 * (`@thallesp/nestjs-better-auth`, `@AllowAnonymous()`) reads; a spec in modules/identity checks
 * both decorators set it. Contexts use `@Public()`, so they never import the auth library.
 */
export const PUBLIC_ROUTE = 'PUBLIC';

/**
 * The route needs no session (AC-01.5.3). Every route is private unless marked, and the route
 * inventory e2e fails when a public route is not on its allowlist (AC-01.5.4).
 */
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
