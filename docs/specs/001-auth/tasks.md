# 001 — Tasks

Prerequisites from [007-ci-and-dx](../007-ci-and-dx/tasks.md): **T-007-01** (Compose with PostgreSQL and `.env.example`; the pnpm/Turborepo workspace and the `apps/api` Nest 11 app already exist in the repo) and **T-007-02** (validated config module, `APP_ENV`, `PORT`, `DATABASE_URL`). Tasks **T-001-01 … T-001-04 are the API foundation**. Every later API spec depends on them. Paths follow [overview §6.2](../../architecture/overview.md#62-api-appsapi).

| ID       | Task                                                                                           | Depends on                   | Size | Branch                       |
| -------- | ---------------------------------------------------------------------------------------------- | ---------------------------- | ---- | ---------------------------- |
| T-001-01 | **API foundation** — auth and security variables + production rules in the T-007-02 config     | T-007-02                     | S    | `feat/001-auth-config`       |
| T-001-02 | **API foundation** — Prisma module and integration-test harness                                | T-007-01, T-007-02           | S    | `feat/001-prisma-module`     |
| T-001-03 | **API foundation** — HTTP conventions: prefix, versioning, validation, envelopes, error filter | T-007-02                     | M    | `feat/001-http-conventions`  |
| T-001-04 | **API foundation** — security baseline: helmet, CORS, body limit, log redaction                | T-001-01, T-001-03           | S    | `feat/001-security-baseline` |
| T-001-05 | Identity schema (Better Auth tables) and migration                                             | T-001-02                     | S    | `feat/001-identity-schema`   |
| T-001-06 | Mount Better Auth: sign-up, sign-in, sign-out, get-session                                     | T-001-01, T-001-04, T-001-05 | M    | `feat/001-better-auth`       |
| T-001-07 | Sign-up name rule, password policy, email trimming                                             | T-001-06                     | S    | `feat/001-signup-validation` |
| T-001-08 | Global auth guard, CSRF guard, public liveness, route-inventory test                           | T-001-06                     | M    | `feat/001-route-protection`  |
| T-001-09 | `CurrentOwner` decorator, `Owner` type, two-user test helper                                   | T-001-08                     | S    | `feat/001-current-owner`     |
| T-001-10 | Client-IP middleware and Better Auth rate limiter                                              | T-001-06                     | M    | `feat/001-auth-rate-limit`   |
| T-001-11 | Seed the demo user                                                                             | T-001-06                     | S    | `feat/001-seed-demo-user`    |
| T-001-12 | Auth observability: metrics, span owner attribute, auth logs                                   | T-001-09                     | S    | `feat/001-auth-telemetry`    |
| T-001-13 | Auth requests in Bruno/.http, OpenAPI security schemes, `DOCS_ENABLED`                         | T-001-08                     | S    | `docs/001-auth-requests`     |
| T-001-14 | Auth endpoint hardening: 16 kB body cap, generic errors (`onAPIError`), Better Auth logger     | T-001-06                     | S    | `feat/001-auth-hardening`    |
| T-001-15 | API throttlers: per-IP before `AuthGuard`, per-user after                                      | T-001-08, T-001-10           | S    | `feat/001-api-throttlers`    |

---

## T-001-01 — API foundation: auth and security variables in the T-007-02 config

- **Goal:** The auth and security settings are validated at startup by the config module of T-007-02, including the production rules. No duplicate config module.
- **Changes:** `src/config/auth.env.ts` (class-validator env class merged into the T-007-02 `validate()`): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGINS`, `APP_SCHEME`, `TRUSTED_PROXIES`, `AUTH_RATE_LIMIT_ENABLED`, `RATE_LIMIT_MAX` (only if T-007-02 has not declared it), `RATE_LIMIT_IP_MAX`, `SEED_DEMO`, `DOCS_ENABLED`; `.env.example` entries. Production rules keyed on `APP_ENV=production` (never `NODE_ENV`).
- **Covers:** `@AC-01.8.5`, constitution VII.3. Prerequisite for every auth scenario.
- **Done when:**
  - Unit tests: a valid env parses; each missing or invalid variable from the [plan table](plan.md#configuration-validated-at-startup-constitution-vii3) fails with a message naming the variable and **not** its value; a short `BETTER_AUTH_SECRET` fails.
  - One unit test **per production rule** with `APP_ENV=production`: example secret rejected; `BETTER_AUTH_URL` not `https` rejected; `CORS_ORIGINS` with `*`, an `http://` origin or `localhost` rejected; `AUTH_RATE_LIMIT_ENABLED=false` rejected; `APP_SCHEME=exp` rejected; `SEED_DEMO=true` rejected; `DOCS_ENABLED` resolves to `false`. The same values pass with `APP_ENV=local`.

## T-001-02 — API foundation: Prisma module and integration-test harness

- **Goal:** One `PrismaService` with a managed lifecycle, and a reusable Testcontainers setup for integration and e2e tests.
- **Changes:** `apps/api/prisma/schema.prisma` (datasource and generator only), `src/shared/infrastructure/prisma/{prisma.module.ts,prisma.service.ts}` (Prisma `log` as events, emitted without query params), `test/support/{postgres.ts,app.ts}` (start PG 17, run `migrate deploy`, build the Nest app), Jest projects `unit` / `integration` / `e2e`.
- **Covers:** prerequisite for all integration and e2e scenarios.
- **Done when:** An integration test starts a container, applies migrations and runs `SELECT 1`. The app shuts down cleanly (`enableShutdownHooks`). `pnpm test:integration` runs in CI.

## T-001-03 — API foundation: HTTP conventions

- **Goal:** Every business response and error follows the contract.
- **Changes:** `app.setup.ts` `setupApp()` (`/api` prefix, URI versioning `v1`, request-id middleware, global pipe, interceptor and filter; shared by `main.ts` and the test app, so nothing is wired in `main.ts`), `shared/presentation/{http-conventions.module.ts,interceptors/envelope.interceptor.ts,decorators/raw-response.decorator.ts,filters/{global-exception.filter.ts,error-codes.ts,domain-error-mappings.ts},pipes/{validation.pipe.ts,parse-uuid.pipe.ts}}` (codes include `CSRF_REJECTED` 403 and `UNSUPPORTED_MEDIA_TYPE` 415), `requestIdMiddleware` in `shared/observability/logging/request-id.ts`, shared with pino's `genReqId` (reuse the incoming `X-Request-Id` only if it matches `^[A-Za-z0-9._-]{1,128}$`, otherwise generate one), a 404 for unknown routes → `ROUTE_NOT_FOUND`.
- **Covers:** `@AC-01.6.6` (pipe level, with a probe DTO; re-verified per resource in T-002-04/08 and T-003-07/10/11), error envelope used by AC-01.5.1, AC-01.6.4, AC-01.7.3.
- **Done when:**
  - Unit tests: `ValidationPipe` errors → `400 VALIDATION_FAILED` with `details[{ field, message }]`, unknown fields rejected (incl. `updatedAt`, `deletedAt`, `__proto__`, `constructor`; the pipe uses `forbidUnknownValues` and plain-object checks so prototype keys never reach a DTO); `HttpException`s map to their codes; unknown errors → `500 INTERNAL_ERROR` with a generic message and `traceId`, stack only in logs; the interceptor wraps the payload as `{ data }` and passes `{ data, meta }` through; `@RawResponse()` skips wrapping.
  - Unit: `X-Request-Id` values `abc-1.2_3` reused; empty, 129 chars, spaces, CR/LF or `<script>` regenerated.
  - E2E: `GET /api/v1/does-not-exist` → `404 ROUTE_NOT_FOUND` in the envelope, and the response carries `X-Request-Id`.

## T-001-04 — API foundation: security baseline

- **Goal:** Safe defaults before any endpoint exists.
- **Changes:** in `setupApp()`: `helmet()` (which also removes `X-Powered-By`) and CORS from `CORS_ORIGINS` (`shared/presentation/cors-options.ts`: exact allowlist with credentials and `exposedHeaders`; `*` answers a literal `*` without credentials). The JSON body limit stays Express's default 100 kB (already asserted by T-001-03's `413` e2e) and is configured once with the Better Auth parsers in T-001-06. Logging rules (delivered by T-006-02 in `shared/observability/logging/redact-paths.ts`; pino `redact` wildcards match one level, so field names are redacted up to depth 3, and headers and bodies are never serialized at all): bodies never logged; redact `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]`, `res.headers["set-auth-token"]` and body keys `password`, `newPassword`, `currentPassword`, `token` at any depth; strip query strings from `/api/auth/*` URLs.
- **Covers:** plan STRIDE rows "Information disclosure (secrets in logs)" and "Tampering (CSRF)".
- **Done when:** E2E: security headers are present, a disallowed `Origin` gets no `Access-Control-Allow-Origin`. `CORS_ORIGINS=*` (allowed locally only) must answer with a literal `Access-Control-Allow-Origin: *` and **never** reflect the request `Origin` together with `Access-Control-Allow-Credentials: true` (PR #19 review); an e2e asserts it. Unit (nested objects): the redaction config masks every path above, including `{ a: { b: { newPassword } } }` and arrays of objects; an `/api/auth/*` URL is logged without its query string; a request body never appears in a log line.

## T-001-05 — Identity schema and migration

- **Goal:** Persist users, sessions, accounts and verifications with the Better Auth schema mapped to snake_case.
- **Changes:** `schema.prisma` models `User`, `Session`, `Account`, `Verification` (`@@map`, `@map`), migration `create_identity_tables`, `docs/architecture/data-model.md` checked for drift.
- **Covers:** data for all US-01.x scenarios.
- **Done when:** `prisma migrate dev` produces a reviewed SQL migration (unique `users.email`, unique `sessions.token`, FKs `ON DELETE CASCADE`, indexes on `user_id`). An integration test applies it on an empty database.

## T-001-06 — Mount Better Auth

- **Goal:** Working email/password auth at `/api/auth/*` for cookie and bearer clients.
- **Changes:** `modules/identity/{auth.factory.ts,identity.module.ts}`. `AuthModule.forRootAsync` with `disableGlobalAuthGuard: true` (the guard comes in T-001-08) and `bodyParser.json.limit = '100kb'`. `NestFactory.create(..., { bodyParser: false })`. Plugins `bearer({ requireSignature: true })`, `expo()`. `trustedOrigins` (app scheme, `CORS_ORIGINS`, `exp://` only when `APP_ENV=local`). `generateId: 'uuid'` (text column; `ownerId` stays opaque). Session `expiresIn` 7d and `updateAge` 1d. `trustedOrigins` never contains `*`; `disableTrustedOriginsCors: true` (the app's CORS and helmet cover `/api/auth/*`). `advanced.disableOriginCheck: false` and `disableCSRFCheck: false` set explicitly, since Better Auth skips both under `NODE_ENV=test` by default. Password hashing goes through an injectable `PASSWORD_HASHER` holding Better Auth's own functions (spied in e2e). The API's Jest scripts run with `NODE_OPTIONS=--experimental-vm-modules` (the auth packages are ESM-only).
- **Covers:** `@AC-01.1.1 @AC-01.1.2 @AC-01.1.3 @AC-01.1.4 @AC-01.1.6 @AC-01.2.1 @AC-01.2.2 @AC-01.2.3 @AC-01.2.7 @AC-01.2.8 @AC-01.3.1 @AC-01.3.2 @AC-01.3.3 @AC-01.4.1 @AC-01.4.2 @AC-01.4.3 @AC-01.4.4`
- **Status:** done
- **Done when:**
  - E2E covers each listed scenario. The bearer token comes from `set-auth-token`. Expiry and renewal are simulated by editing `sessions.expires_at`.
  - E2E: a JSON `POST` to a non-auth route is parsed (body parsers re-added), and a 101 kb body → 413.
  - E2E: sign-in with an unknown email still calls the password hasher (spy) and returns the same body as a wrong password (AC-01.2.7). A sign-in with an untrusted `Origin` is rejected and issues no session (AC-01.2.8).
  - Unit: `trustedOrigins` includes `exp://` only with `APP_ENV=local`. The created user id is a UUID.

## T-001-07 — Sign-up name rule, password policy, email trimming

- **Goal:** Enforce BR-01.2 and BR-01.3 at sign-up, and trim emails on sign-in and sign-up.
- **Changes:** `modules/identity/hooks/auth-input.hook.ts` (`hooks.before`: name trimmed, 1–100 code points, no `\p{Cc}` control characters; `email` trimmed on `/sign-in/email` and `/sign-up/email`; passwords never trimmed), password min/max asserted in the factory.
- **Covers:** `@AC-01.1.3 @AC-01.1.5 @AC-01.2.6`
- **Done when:** Unit tests for the hook (blank, 1, 100, 101 code points, trimmed, a name with `\n` or NUL → 400; `"  Demo@Teams-Tasks.dev "` trimmed; a password with leading/trailing spaces passed through unchanged). E2E: outline rows for name and password boundaries pass; sign-in with a space-padded, mixed-case email succeeds; sign-in with the password plus a trailing space fails.

## T-001-08 — Global auth guard, CSRF guard, public liveness, route inventory

- **Goal:** Deny by default. Only health (plus `/api/auth/*` and, while enabled, `/docs`) is public. Cookie-authenticated mutations are protected against CSRF.
- **Changes:** `APP_GUARD` → `AuthGuard` (the slot before it is reserved for the per-IP throttler of T-001-15), then `CsrfGuard` (`modules/identity/presentation/csrf.guard.ts`: unsafe methods on `/api/v1` authenticated by cookie with no `Authorization` header; `Origin`/`Referer` present and not in `trustedOrigins`, or `Sec-Fetch-Site: cross-site` → `403 CSRF_REJECTED`; body without `Content-Type: application/json` → `415 UNSUPPORTED_MEDIA_TYPE`). Global filter mapping `UnauthorizedException` → `401 UNAUTHENTICATED` and the CSRF errors. `modules/health/health.controller.ts` with **only** `GET /health/live` (`@AllowAnonymous() @SkipThrottle() @RawResponse()`; T-006-03 extends it with readiness). `test/e2e/route-inventory.e2e-spec.ts` (`DiscoveryService` + `Reflector`: every handler outside the allowlist lacks the public metadata).
- **Covers:** `@AC-01.5.1 @AC-01.5.2 @AC-01.5.3 @AC-01.5.4 @AC-01.5.5 @AC-01.5.6 @AC-01.5.7 @AC-01.5.8 @AC-01.5.9 @AC-01.5.10 @AC-01.2.4 @AC-01.2.5`
- **Done when:** E2E with a test-only probe controller mounted in the test module: anonymous / malformed / forged / revoked / expired / empty / `Basic` / **unsigned raw `sessions.token`** → 401 envelope; bearer and cookie both pass; bearer of A + cookie of B → processed as A. CSRF: a cookie-authenticated `POST` with an untrusted `Origin` → 403 and nothing changes; `Sec-Fetch-Site: cross-site` → 403; `text/plain` body → 415; the same requests with a bearer token (no `Origin` or an untrusted one, AC-01.5.10), or a cookie with no `Origin` (native client), pass. The route inventory fails if a public route is added without being on the allowlist. The `operation` rows for teams and tasks in AC-01.5.1 are re-run against the real endpoints in T-002-04 and the 003 tasks.

## T-001-09 — `CurrentOwner` decorator and two-user helper

- **Goal:** Controllers receive `Owner { ownerId }`. Application code never sees Better Auth types.
- **Changes:** `shared/domain/owner.ts`, `modules/identity/presentation/current-owner.decorator.ts`, `dependency-cruiser` rule "only `modules/identity/**` may import `better-auth*` / `@thallesp/*`", `test/support/auth.ts` (`signUpAndSignIn`, `twoUsers`).
- **Covers:** foundation for `@AC-01.6.1 @AC-01.6.2 @AC-01.6.3 @AC-01.6.4 @AC-01.6.5 @AC-01.6.6`, which are verified per resource in T-002-04/06/07/08/09 and the 003 tasks.
- **Done when:** Unit test of the decorator (user → owner; missing user → 401). The probe controller e2e returns the signed-in user's id. The `depcruise` rule fails on a deliberate violation in a fixture.

## T-001-10 — Client-IP middleware and Better Auth rate limiter

- **Goal:** Credential routes 10/min per endpoint per client address, session check 100/min per address, and no IP spoofing or shared bucket.
- **Changes:** `modules/identity/middleware/client-ip.middleware.ts` (registered before the Better Auth handler: deletes any incoming `x-tt-client-ip`, sets it from `req.socket.remoteAddress`, or `req.ip` only when `TRUSTED_PROXIES` is set). Express `trust proxy` from `TRUSTED_PROXIES`. Better Auth `rateLimit` (`enabled` from `AUTH_RATE_LIMIT_ENABLED`, per-endpoint `customRules`) and `advanced.ipAddress.ipAddressHeaders: ['x-tt-client-ip']`. Runbook note on the Docker Desktop / WSL NAT caveat (all host traffic may share one address).
- **Covers:** `@AC-01.7.1 @AC-01.7.2 @AC-01.7.6 @AC-01.7.7 @AC-01.7.8 @AC-01.7.11`
- **Done when:** E2E, each in a fresh app instance and **asserting the resolved client IP** (spy on Better Auth's resolved address; the suite must not rely on its fixed address under `NODE_ENV=test`): the 11th sign-in from one address → 429 with `X-Retry-After` and no credential check (spy on verify), while sign-up from the same address is still accepted (buckets per endpoint); after the window (limiter with injectable clock or 1 s window via config) → accepted; client A throttled does not throttle client B (distinct loopback `localAddress` 127.0.0.2 / 127.0.0.3, or `TRUSTED_PROXIES=127.0.0.1/32` + `X-Forwarded-For`); a rotating `X-Forwarded-For` or a client-sent `x-tt-client-ip` without `TRUSTED_PROXIES` is still throttled; 100 session checks → all 200, the 101st → 429. With `TRUSTED_PROXIES=127.0.0.1/32`, two clients forwarded with different `X-Forwarded-For` addresses are throttled independently; the same header from a connection outside the CIDRs is ignored (AC-01.7.11).

## T-001-11 — Seed the demo user

- **Goal:** `demo@teams-tasks.dev` / `Demo@1234` exists after every seed (when enabled), with a stable id, and never in production.
- **Changes:** `prisma/seed/identity.seed.ts` (fixed literal fixture, no faker; `DEMO_USER_ID` fixed UUID; skipped unless `SEED_DEMO=true` and never when `APP_ENV=production`; if absent, created via `auth.api.signUpEmail` with `databaseHooks.user.create.before` setting `DEMO_USER_ID`; if present, untouched), called from the `prisma/seed.ts` orchestrator (T-007-07 owns it; this task adds a minimal one if it has not landed), `package.json` `prisma.seed` / `db:seed` script if missing.
- **Covers:** `@AC-01.8.1 @AC-01.8.2 @AC-01.8.4` (`@AC-01.8.3` is completed by T-002-11 and T-003-15)
- **Done when:** Integration: seed twice → one user, same id (`DEMO_USER_ID`), same account row and password hash, `updated_at` unchanged on the second run; `SEED_DEMO=false` → no demo user; `APP_ENV=production` → no demo user even if the flag is forced in the test. E2E: sign-in with the demo credentials succeeds.

## T-001-12 — Auth observability

- **Goal:** Auth outcomes are visible without leaking identity data.
- **Changes:** `Metrics` port use for `auth_sign_in_total`, `auth_sign_up_total`, `api_rate_limited_total`. Better Auth `hooks.after` for outcomes. An interceptor sets `enduser.id` on the active span. Auth log events.
- **Covers:** plan [Observability](plan.md#observability).
- **Done when:** Unit tests with an in-memory metrics fake: success, invalid credentials and rate-limited outcomes increment the right labels. A log capture shows no email, password, token or cookie.

## T-001-13 — Auth requests and OpenAPI security

- **Goal:** Evaluators can sign in from Bruno or `.http` and use the token, the OpenAPI document declares the security schemes, and `/docs` is served only while `DOCS_ENABLED`.
- **Changes:** `tools/bruno/auth/*.bru` (sign-up, sign-in with a post-response script saving `set-auth-token`, get-session, sign-out), `tools/http/auth.http`, Swagger `addBearerAuth()` / `addCookieAuth()` with global security, an Identity tag fragment for `/api/auth/*`, and `SwaggerModule.setup` only when `DOCS_ENABLED` (forced `false` with `APP_ENV=production`).
- **Covers:** `@AC-01.8.6`, brief "exemplos de requisições" for auth. Supports AC-01.8.1 and the `/docs` part of AC-01.5.4.
- **Done when:** The Bruno collection runs green against `docker compose up` (`bru run tools/bruno/auth`). `/docs/openapi.json` lists the security schemes, and health has none. E2E: `DOCS_ENABLED=false` → `/docs` and `/docs/openapi.json` return 404; `APP_ENV=production` → 404 regardless of `DOCS_ENABLED`.

## T-001-14 — Auth endpoint hardening

- **Goal:** `/api/auth/*` rejects oversized bodies before hashing, never leaks database errors, and logs through pino.
- **Changes:** `modules/identity/middleware/auth-body-limit.middleware.ts` (16 kB cap on `/api/auth/*` by `Content-Length` and streamed byte count → `413`, registered before the Better Auth handler), Better Auth `onAPIError` (generic error body, details logged with `traceId`), Better Auth `logger` bridged to pino at `warn`.
- **Covers:** `@AC-01.7.10 @AC-01.4.5`, plan STRIDE rows "Information disclosure (secrets in logs or errors)" and "Denial of service".
- **Done when:** E2E: a 16 kB + 1 byte sign-in body → 413 and the password hasher is never called (spy); a 16 kB body is accepted. E2E with the database stopped (or the Prisma adapter forced to throw): `/api/auth/sign-in/email` returns a generic error whose body contains no `Prisma`, `SQL`, table or column names. Unit: Better Auth log calls at `info`/`debug` are dropped and `warn`/`error` reach pino.

## T-001-15 — API throttlers: per-IP before `AuthGuard`, per-user after

- **Goal:** `/api/v1/*` bounds anonymous and forged-token traffic per client address before any session lookup, and authenticated traffic per user.
- **Changes:** `ThrottlerModule.forRootAsync` with two named throttlers: `ip` (`RATE_LIMIT_IP_MAX`, default 300/min, tracker = the same resolved client IP as `x-tt-client-ip`) and `user` (`RATE_LIMIT_MAX`, default 100/min, tracker `req.user?.id ?? clientIp`). `IpThrottlerGuard` registered as the **first** `APP_GUARD` (before `AuthGuard`), `OwnerThrottlerGuard` **after** `CsrfGuard`. Filter maps `ThrottlerException` → `429 RATE_LIMITED` + `Retry-After`. Health `@SkipThrottle()` for both.
- **Covers:** `@AC-01.7.3 @AC-01.7.4 @AC-01.7.5 @AC-01.7.9`
- **Done when:** E2E, each in a fresh app instance with small limits from config: anonymous requests from one address beyond `RATE_LIMIT_IP_MAX` → **429 `RATE_LIMITED`, not 401**; under the IP limit an anonymous request → 401 and consumes no per-user bucket; the 101st business request of a user → `429 RATE_LIMITED` + `Retry-After`; another user from another address is unaffected; 150 liveness calls → all 200.
