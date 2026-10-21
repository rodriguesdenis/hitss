# ADR-0007 — Better Auth for authentication

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, security-specialist, nestjs-specialist

## Context

The brief does not require authentication, but without it "teams and tasks" are global and any production note would start with "add auth". We scope every resource to an owner (constitution §VI.2), which needs a real identity. Constraints: the project must run **offline with one command** (no external identity provider), work in **Expo Go**, be callable with **cURL/Bruno**, and stay within the Nest ecosystem.

## Decision drivers

- Self-hosted, runs inside our container against our PostgreSQL.
- Secure defaults (password hashing, session rotation, CSRF/origin checks, rate limiting on auth routes) without writing crypto glue.
- Works for a native app (no browser cookies jar) **and** plain HTTP clients.
- Idiomatic NestJS integration: global guard, decorators, public-route opt-out.
- Small surface: email + password is enough for the scope.

## Considered options

### 1. Better Auth + Prisma adapter + `bearer` + `@better-auth/expo` (chosen)

- **+** TypeScript-first, framework-agnostic, stores users/sessions in our database through the Prisma adapter.
- **+** `bearer` plugin returns the session token in `set-auth-token`, so `Authorization: Bearer` works from cURL/Bruno.
- **+** `@better-auth/expo` (server plugin + `expoClient`) persists the session in `expo-secure-store` and handles the native origin; works in Expo Go.
- **+** Community package `@thallesp/nestjs-better-auth` provides a global `AuthGuard`, `@Session()`, `@AllowAnonymous()`, `@OptionalAuth()`.
- **−** Younger than Passport; the Nest integration is community-maintained (pinned version, covered by e2e tests).
- **−** Requires disabling Nest's body parser (`NestFactory.create(AppModule, { bodyParser: false })`) so Better Auth reads raw bodies; the module re-enables JSON parsing for other routes.

### 2. Hand-rolled Passport + JWT (`@nestjs/passport`, `@nestjs/jwt`)

- **+** Canonical Nest docs example; no third-party auth library.
- **−** We would own password hashing parameters, refresh-token rotation, revocation, sign-out semantics and brute-force protection — security-sensitive code with no product value.
- **−** Stateless JWTs make revocation (sign-out everywhere) hard without a denylist.

### 3. Hosted identity (Auth0, Clerk, Supabase Auth, Firebase Auth)

- **+** Battle-tested, MFA/social login for free.
- **−** Requires internet access, an account and secrets — breaks "clone + `docker compose up`" and offline evaluation.
- **−** Vendor lock-in and extra configuration for evaluators.

### 4. Lucia / Auth.js

- **−** Lucia is now a learning resource, not a maintained library; Auth.js targets web frameworks and has weaker native-app support.

## Decision outcome

- **Server:** `betterAuth({ database: prismaAdapter(prisma, { provider: "postgresql" }), emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 }, plugins: [bearer({ requireSignature: true }), expo()], trustedOrigins: [...], advanced: { database: { generateId: "uuid" }, ipAddress: { ipAddressHeaders: ["x-tt-client-ip"] } }, onAPIError: { … } })`, configured from validated env (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`).
- **User ids:** generated as UUIDs (`generateId: "uuid"`) and stored in Better Auth's `text` columns. The domain keeps `ownerId` as an opaque string and never relies on its format.
- **Mount:** `@thallesp/nestjs-better-auth` `AuthModule.forRoot({ auth })` exposes Better Auth at **`/api/auth/*`** and registers a **global `AuthGuard`**. Every route is authenticated by default; `@AllowAnonymous()` is used only on health and docs (constitution §VI.1).
- **Ownership:** controllers read `@Session() session` and pass `session.user.id` as `ownerId` into commands/queries; repositories always filter by `ownerId`; foreign ids → `404`.
- **trustedOrigins:** the app scheme (`teamstasks://`) always, plus the explicit web origins from `CORS_ORIGINS`; `exp://` (Expo Go) only when `APP_ENV=development`. (Better Auth's `expo()` plugin also adds `exp://` by itself when `NODE_ENV=development` — library behavior, so production images must not run with `NODE_ENV=development`.) A unit test pins the list per environment.
- **Mobile:** `createAuthClient({ baseURL, plugins: [expoClient({ scheme: "teamstasks", storagePrefix: "teamstasks", storage: SecureStore })] })`. The generated API client's mutator obtains auth headers from the auth client (`authClient.getCookie()` → `Cookie` header), as recommended by Better Auth for Expo.
- **Rate limiting:** `/api/auth/*` is served by Better Auth outside Nest controllers, so the Nest throttler cannot see it. Better Auth's **built-in limiter** (explicitly `enabled`, memory storage) applies per IP: `sign-up`, `sign-in`, `sign-out` 10 req/min each, per endpoint (`customRules`), everything else incl. `get-session` 100 req/min. The client IP comes from our client-IP middleware (see [Security controls](#security-controls)), never from client-controlled headers. Its `429` uses Better Auth's native format (with `X-Retry-After`). `/api/v1/*` uses `@nestjs/throttler` in two layers: a per-IP limit (300 req/min, configurable) that runs **before** `AuthGuard` (bounds anonymous and forged-token traffic) and 100 req/min per user after it, both answering `429 RATE_LIMITED` in our envelope.
- **Response format:** `/api/auth/*` keeps Better Auth's native responses and errors — a documented exception to the envelope (constitution §IV.2).
- **Logging:** request/response bodies are never logged; `authorization`, `cookie`, `set-cookie` and `set-auth-token` headers are redacted; query strings of `/api/auth/*` URLs are stripped; Better Auth's own `logger` is routed to pino at `warn`. Tokens, cookies and passwords never appear in logs ([threat model](../../security/threat-model.md#logging-redaction)).

### Security controls

| Control             | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client IP           | Better Auth only reads the IP from request headers (it sees a Web `Request`, not the socket). With no resolvable IP it falls back to a single shared bucket, so one attacker could throttle every user. A Nest middleware registered **before** the Better Auth handler deletes any incoming `x-tt-client-ip` and sets it from `req.ip`; Better Auth reads only that header (`ipAddressHeaders: ["x-tt-client-ip"]`). `req.ip` is the socket address unless `TRUSTED_PROXIES` (CIDR list, empty by default) is set, which configures Express `trust proxy`. The same `req.ip` feeds the per-IP Nest throttler. E2E tests run the limiter with a resolved IP asserted (not Better Auth's test-mode fallback) and prove two addresses have independent buckets.           |
| Bearer tokens       | `bearer({ requireSignature: true })`: only the signed token from `set-auth-token` is accepted. A raw `sessions.token` read from the database (backup, SQL injection) is not a usable credential, and forged tokens fail the signature check without a session lookup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CSRF on cookie auth | Better Auth checks origins on `/api/auth/*` only. For `/api/v1/*`, a guard runs on unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) when the session came from the cookie (no `Authorization` header): it rejects `Sec-Fetch-Site: cross-site` and any `Origin` not in `trustedOrigins` with **`403 CSRF_REJECTED`** ("Cookie-authenticated state-changing request from an untrusted origin."). Independently, every `POST`/`PUT`/`PATCH` body must be `application/json` (`415 UNSUPPORTED_MEDIA_TYPE`), so form-encoded cross-site posts never reach a handler. Native clients (Expo `getCookie()`, no browser cookie jar) send no `Origin`, so they are unaffected; bearer clients skip the guard. Cookies stay `HttpOnly`, `SameSite=Lax`, `Secure` in production. |
| Request size        | `/api/auth/*` bodies are capped at **16 kB** by a middleware in front of the handler (`413`, before any hashing); `/api/v1/*` keeps the 100 kB JSON limit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Errors              | `onAPIError` is configured so unexpected failures on `/api/auth/*` return a generic `500` without Prisma or SQL text; details go to logs with the `traceId`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Demo account        | Seeded only when `SEED_DEMO=true` (default `true` in the compose development profile). Config validation rejects `SEED_DEMO=true` with `APP_ENV=production`, so a known password never ships.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Production config   | Startup validation fails when `APP_ENV=production` (production gating keys on `APP_ENV`, not `NODE_ENV`) and: `BETTER_AUTH_SECRET` is the example value or shorter than 32 chars; `BETTER_AUTH_URL` is not `https`; `CORS_ORIGINS` contains `*`, `http://` or `localhost`; `AUTH_RATE_LIMIT_ENABLED=false`; `SEED_DEMO=true`. API docs follow `DOCS_ENABLED` (off by default when `APP_ENV=production`). Error messages name the variable, never its value.                                                                                                                                                                                                                                                                                                             |
| Password policy     | Length only, 8–128 (NIST SP 800-63B), no composition rules, no trimming. Passwords are not Unicode-normalized (documented); breached-password screening is a production improvement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

## Consequences

**Positive**

- Production-grade sessions (DB-backed, revocable) with very little code.
- Same identity works for the app (secure-store cookie) and for humans (Bearer).
- The domain stays unaware of auth: it only sees an `ownerId`.

**Negative**

- Dependency on a community Nest adapter; mitigated by pinning and e2e tests on guard behavior (401 without session, public routes reachable).
- Better Auth uses `text` id columns for users (UUID values); our tables reference `users.id` as `text`.
- Two limiters with two `429` formats (Better Auth native on `/api/auth/*`, envelope on `/api/v1/*`); clients handle both.
- The memory limiter storage is per instance; production with several instances would use secondary storage (Redis).
- Sign-up necessarily reveals that an email is registered (accepted risk, rate limited); production would use verification-first sign-up.
- Sliding sessions have no absolute lifetime; production would add an absolute maximum age with re-authentication.

**Neutral**

- Email verification, password reset and social login are out of scope but available as Better Auth options.

## Links

- [Spec 001 — Auth](../../specs/001-auth/spec.md) · [API contracts — Identity](../api-contracts.md#identity--apiauth)
- Better Auth: https://www.better-auth.com/docs · Expo integration: https://www.better-auth.com/docs/integrations/expo
- NestJS integration: https://github.com/ThallesP/nestjs-better-auth
