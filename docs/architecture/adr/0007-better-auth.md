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

- **Server:** `betterAuth({ database: prismaAdapter(prisma, { provider: "postgresql" }), emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 }, plugins: [bearer(), expo()], trustedOrigins: [...], advanced: { database: { generateId: "uuid" } } })`, configured from validated env (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`).
- **User ids:** generated as UUIDs (`generateId: "uuid"`) and stored in Better Auth's `text` columns. The domain keeps `ownerId` as an opaque string and never relies on its format.
- **Mount:** `@thallesp/nestjs-better-auth` `AuthModule.forRoot({ auth })` exposes Better Auth at **`/api/auth/*`** and registers a **global `AuthGuard`**. Every route is authenticated by default; `@AllowAnonymous()` is used only on health and docs (constitution §VI.1).
- **Ownership:** controllers read `@Session() session` and pass `session.user.id` as `ownerId` into commands/queries; repositories always filter by `ownerId`; foreign ids → `404`.
- **trustedOrigins:** the app scheme (`teamstasks://`) always; `exp://*` and the Metro dev origins only when `NODE_ENV=development`.
- **Mobile:** `createAuthClient({ baseURL, plugins: [expoClient({ scheme: "teamstasks", storagePrefix: "teamstasks", storage: SecureStore })] })`. The generated API client's mutator obtains auth headers from the auth client (`authClient.getCookie()` → `Cookie` header), as recommended by Better Auth for Expo.
- **Rate limiting:** `/api/auth/*` is served by Better Auth outside Nest controllers, so the Nest throttler cannot see it. Better Auth's **built-in limiter** (explicitly `enabled`, memory storage) applies per IP: `sign-up`, `sign-in`, `sign-out` 10 req/min (`customRules`), everything else incl. `get-session` 100 req/min. The client IP is the socket address; forwarded headers (`X-Forwarded-For`) are not trusted unless `ipAddressHeaders` is configured for a known proxy. Its `429` uses Better Auth's native format (with `X-Retry-After`). `/api/v1/*` uses `@nestjs/throttler` at 100 req/min per user (falls back to IP), answering `429 RATE_LIMITED` in our envelope.
- **Response format:** `/api/auth/*` keeps Better Auth's native responses and errors — a documented exception to the envelope (constitution §IV.2).
- **Logging:** request/response bodies of `/api/auth/*` are redacted in pino; tokens and cookies never logged.

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

**Neutral**

- Email verification, password reset and social login are out of scope but available as Better Auth options.

## Links

- [Spec 001 — Auth](../../specs/001-auth/spec.md) · [API contracts — Identity](../api-contracts.md#identity--apiauth)
- Better Auth: https://www.better-auth.com/docs · Expo integration: https://www.better-auth.com/docs/integrations/expo
- NestJS integration: https://github.com/ThallesP/nestjs-better-auth
