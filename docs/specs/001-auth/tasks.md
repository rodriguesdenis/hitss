# 001 — Tasks

Prerequisite: the workspace scaffold from [007-ci-and-dx](../007-ci-and-dx/tasks.md), meaning the pnpm and Turborepo workspace, an empty `apps/api` Nest 11 app, and Docker Compose with PostgreSQL. Tasks **T-001-01 … T-001-04 are the API foundation**. Every later API spec depends on them.

| ID       | Task                                                                                           | Depends on         | Size | Branch                       |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------ | ---- | ---------------------------- |
| T-001-01 | **API foundation** — typed config with fail-fast validation                                    | 007 scaffold       | S    | `feat/001-config-validation` |
| T-001-02 | **API foundation** — Prisma module and integration-test harness                                | T-001-01           | S    | `feat/001-prisma-module`     |
| T-001-03 | **API foundation** — HTTP conventions: prefix, versioning, validation, envelopes, error filter | T-001-01           | M    | `feat/001-http-conventions`  |
| T-001-04 | **API foundation** — security baseline: helmet, CORS, body limit, log redaction                | T-001-03           | S    | `feat/001-security-baseline` |
| T-001-05 | Identity schema (Better Auth tables) and migration                                             | T-001-02           | S    | `feat/001-identity-schema`   |
| T-001-06 | Mount Better Auth: sign-up, sign-in, sign-out, get-session                                     | T-001-04, T-001-05 | M    | `feat/001-better-auth`       |
| T-001-07 | Sign-up name rule and password policy                                                          | T-001-06           | S    | `feat/001-signup-validation` |
| T-001-08 | Global auth guard, public health liveness, route-inventory test                                | T-001-06           | M    | `feat/001-route-protection`  |
| T-001-09 | `CurrentOwner` decorator, `Owner` kernel type, two-user test helper                            | T-001-08           | S    | `feat/001-current-owner`     |
| T-001-10 | Rate limiting: auth limiter and per-user API throttler                                         | T-001-08           | M    | `feat/001-rate-limiting`     |
| T-001-11 | Seed the demo user                                                                             | T-001-06           | S    | `feat/001-seed-demo-user`    |
| T-001-12 | Auth observability: metrics, span owner attribute, auth logs                                   | T-001-09           | S    | `feat/001-auth-telemetry`    |
| T-001-13 | Auth requests in Bruno/.http and the OpenAPI security schemes                                  | T-001-08           | S    | `docs/001-auth-requests`     |

---

## T-001-01 — API foundation: typed config with fail-fast validation

- **Goal:** The API refuses to start on invalid configuration. All code reads config through one typed provider.
- **Changes:** `apps/api/src/config/{env.schema.ts,app-config.ts,config.module.ts}`, `.env.example`, ESLint `no-restricted-properties` for `process.env` outside `config/`.
- **Covers:** constitution VII.3 (no BDD scenario). Prerequisite for every auth scenario.
- **Done when:**
  - Unit tests: a valid env parses; each missing or invalid variable from the [plan table](plan.md#configuration-validated-at-startup-constitution-vii3) fails with a message naming the variable and **not** its value; a short `BETTER_AUTH_SECRET` fails; the example secret is rejected when `NODE_ENV=production`.
  - `pnpm --filter @hitss/api start` with an empty env exits non-zero with one readable error.

## T-001-02 — API foundation: Prisma module and integration-test harness

- **Goal:** One `PrismaService` with a managed lifecycle, and a reusable Testcontainers setup for integration and e2e tests.
- **Changes:** `apps/api/prisma/schema.prisma` (datasource and generator only), `src/infrastructure/prisma/{prisma.module.ts,prisma.service.ts}`, `test/support/{postgres.ts,app.ts}` (start PG 17, run `migrate deploy`, build the Nest app), Jest projects `unit` / `integration` / `e2e`.
- **Covers:** prerequisite for all integration and e2e scenarios.
- **Done when:** An integration test starts a container, applies migrations and runs `SELECT 1`. The app shuts down cleanly (`enableShutdownHooks`). `pnpm test:integration` runs in CI.

## T-001-03 — API foundation: HTTP conventions

- **Goal:** Every business response and error follows the contract.
- **Changes:** `main.ts` (`/api` prefix, URI versioning `v1`, `bodyParser: false` placeholder comment), `shared/http/{envelope.interceptor.ts,raw-response.decorator.ts,http-exception.filter.ts,error-codes.ts,validation.pipe.ts}`, `X-Request-Id` middleware (reuse incoming or generate), a 404 for unknown routes → `ROUTE_NOT_FOUND`.
- **Covers:** error envelope used by AC-01.5.1, AC-01.6.4, AC-01.7.3.
- **Done when:**
  - Unit tests: `ValidationPipe` errors → `400 VALIDATION_FAILED` with `details[{ field, message }]`, unknown fields rejected; `HttpException`s map to their codes; unknown errors → `500 INTERNAL_ERROR` with a generic message and `traceId`, stack only in logs; the interceptor wraps the payload as `{ data }` and passes `{ data, meta }` through; `@RawResponse()` skips wrapping.
  - E2E: `GET /api/v1/does-not-exist` → `404 ROUTE_NOT_FOUND` in the envelope, and the response carries `X-Request-Id`.

## T-001-04 — API foundation: security baseline

- **Goal:** Safe defaults before any endpoint exists.
- **Changes:** `helmet()`, CORS allowlist from `CORS_ORIGINS` with `exposedHeaders`, `x-powered-by` disabled, pino redaction paths (constants in `shared/logging/redaction.ts`, consumed by the logger set up in 006 or by a minimal pino logger until then).
- **Covers:** plan STRIDE rows "Information disclosure (secrets in logs)" and "Tampering (CSRF)".
- **Done when:** E2E: security headers are present, a disallowed `Origin` gets no `Access-Control-Allow-Origin`. Unit: the redaction config masks `authorization`, `cookie`, `set-cookie`, `set-auth-token`, `password` and `token`.

## T-001-05 — Identity schema and migration

- **Goal:** Persist users, sessions, accounts and verifications with the Better Auth schema mapped to snake_case.
- **Changes:** `schema.prisma` models `User`, `Session`, `Account`, `Verification` (`@@map`, `@map`), migration `create_identity_tables`, `docs/architecture/data-model.md` checked for drift.
- **Covers:** data for all US-01.x scenarios.
- **Done when:** `prisma migrate dev` produces a reviewed SQL migration (unique `users.email`, unique `sessions.token`, FKs `ON DELETE CASCADE`, indexes on `user_id`). An integration test applies it on an empty database.

## T-001-06 — Mount Better Auth

- **Goal:** Working email/password auth at `/api/auth/*` for cookie and bearer clients.
- **Changes:** `modules/identity/{auth.factory.ts,identity.module.ts}`. `AuthModule.forRootAsync` with `disableGlobalAuthGuard: true` (the guard comes in T-001-08) and `bodyParser.json.limit = '100kb'`. `NestFactory.create(..., { bodyParser: false })`. Plugins `bearer()`, `expo()`. `trustedOrigins` (app scheme, `exp://` only in development). `generateId: 'uuid'`. Session `expiresIn` 7d and `updateAge` 1d.
- **Covers:** `@AC-01.1.1 @AC-01.1.2 @AC-01.1.3 @AC-01.1.4 @AC-01.1.6 @AC-01.2.1 @AC-01.2.2 @AC-01.2.3 @AC-01.3.1 @AC-01.3.2 @AC-01.3.3 @AC-01.4.1 @AC-01.4.2 @AC-01.4.3 @AC-01.4.4`
- **Done when:**
  - E2E covers each listed scenario. The bearer token comes from `set-auth-token`. Expiry and renewal are simulated by editing `sessions.expires_at`.
  - E2E: a JSON `POST` to a non-auth route is parsed (body parsers re-added), and a 101 kb body → 413.
  - Unit: `trustedOrigins` includes `exp://` only in development. The created user id is a UUID.

## T-001-07 — Sign-up name rule and password policy

- **Goal:** Enforce BR-01.2 and BR-01.3 at sign-up.
- **Changes:** `modules/identity/hooks/sign-up-validation.hook.ts` (`hooks.before`, trim and 1–100 chars), password min/max asserted in the factory.
- **Covers:** `@AC-01.1.3 @AC-01.1.5`
- **Done when:** Unit tests for the hook (blank, 1, 100, 101 chars, trimmed). E2E outline rows for name and password boundaries pass.

## T-001-08 — Global auth guard, public liveness, route inventory

- **Goal:** Deny by default. Only health is public.
- **Changes:** `APP_GUARD` → `AuthGuard` (registered first), global filter mapping `UnauthorizedException` → `401 UNAUTHENTICATED`, `modules/health/health.controller.ts` with `GET /health/live` (`@AllowAnonymous() @SkipThrottle() @RawResponse()`; 006 adds readiness), `test/e2e/route-inventory.e2e-spec.ts` (`DiscoveryService` + `Reflector`: every handler outside the allowlist lacks the public metadata).
- **Covers:** `@AC-01.5.1 @AC-01.5.2 @AC-01.5.3 @AC-01.5.4 @AC-01.5.5 @AC-01.2.4 @AC-01.2.5`
- **Done when:** E2E with a test-only probe controller mounted in the test module: anonymous / malformed / forged / revoked / expired / empty / `Basic` → 401 envelope; bearer and cookie both pass. The route inventory fails if a public route is added without being on the allowlist. The `operation` rows for teams and tasks in AC-01.5.1 are re-run against the real endpoints in T-002-04 and the 003 tasks.

## T-001-09 — `CurrentOwner` decorator and two-user helper

- **Goal:** Controllers receive `Owner { ownerId }`. Application code never sees Better Auth types.
- **Changes:** `shared/kernel/owner.ts`, `modules/identity/presentation/current-owner.decorator.ts`, `dependency-cruiser` rule "only `modules/identity/**` may import `better-auth*` / `@thallesp/*`", `test/support/auth.ts` (`signUpAndSignIn`, `twoUsers`).
- **Covers:** foundation for `@AC-01.6.1 @AC-01.6.2 @AC-01.6.3 @AC-01.6.4 @AC-01.6.5`, which are verified per resource in T-002-04/06/07/08/09 and the 003 tasks.
- **Done when:** Unit test of the decorator (user → owner; missing user → 401). The probe controller e2e returns the signed-in user's id. The `depcruise` rule fails on a deliberate violation in a fixture.

## T-001-10 — Rate limiting

- **Goal:** Credential routes 10/min/IP, session check 100/min/IP, business API 100/min/user, health unlimited, and no IP spoofing.
- **Changes:** Better Auth `rateLimit` (`enabled` from config, `customRules`, `ipAddressHeaders` from `TRUSTED_IP_HEADERS`). `ThrottlerModule.forRootAsync`. `OwnerThrottlerGuard` (tracker `req.user?.id ?? req.ip`) registered as the **second** `APP_GUARD`. Filter maps `ThrottlerException` → `429 RATE_LIMITED`.
- **Covers:** `@AC-01.7.1 @AC-01.7.2 @AC-01.7.3 @AC-01.7.4 @AC-01.7.5 @AC-01.7.6 @AC-01.7.7`
- **Done when:** E2E, each in a fresh app instance: the 11th sign-in → 429 with `X-Retry-After` and no credential check (spy on verify); after the window (limiter with injectable clock or 1 s window via config) → accepted; the 101st business request → `429 RATE_LIMITED` + `Retry-After`; another user is unaffected; 150 liveness calls → all 200; a rotating `X-Forwarded-For` is still throttled; 30 session checks → all 200; an anonymous over-limit request → 401, not 429.

## T-001-11 — Seed the demo user

- **Goal:** `demo@teams-tasks.dev` / `Demo@1234` exists after every seed, with a stable id.
- **Changes:** `prisma/seed/index.ts` (orchestrator), `prisma/seed/identity.seed.ts` (`DEMO_USER_ID`, upsert user + credential account, rehash only if `verifyPassword` fails), `package.json` `prisma.seed` / `db:seed` script.
- **Covers:** `@AC-01.8.1 @AC-01.8.2` (`@AC-01.8.3` is completed by T-002-11 and the 003 seed task)
- **Done when:** Integration: seed twice → one user, same id, same account row, `updated_at` unchanged on the second run. E2E: sign-in with the demo credentials succeeds.

## T-001-12 — Auth observability

- **Goal:** Auth outcomes are visible without leaking identity data.
- **Changes:** `Metrics` port use for `auth_sign_in_total`, `auth_sign_up_total`, `api_rate_limited_total`. Better Auth `hooks.after` for outcomes. An interceptor sets `enduser.id` on the active span. Auth log events.
- **Covers:** plan [Observability](plan.md#observability).
- **Done when:** Unit tests with an in-memory metrics fake: success, invalid credentials and rate-limited outcomes increment the right labels. A log capture shows no email, password, token or cookie.

## T-001-13 — Auth requests and OpenAPI security

- **Goal:** Evaluators can sign in from Bruno or `.http` and use the token, and the OpenAPI document declares the security schemes.
- **Changes:** `tools/bruno/auth/*.bru` (sign-up, sign-in with a post-response script saving `set-auth-token`, get-session, sign-out), `tools/http/auth.http`, Swagger `addBearerAuth()` / `addCookieAuth()` with global security, and an Identity tag fragment for `/api/auth/*`.
- **Covers:** brief "exemplos de requisições" for auth. Supports AC-01.8.1.
- **Done when:** The Bruno collection runs green against `docker compose up` (`bru run tools/bruno/auth`). `/docs/openapi.json` lists the security schemes, and health has none.
