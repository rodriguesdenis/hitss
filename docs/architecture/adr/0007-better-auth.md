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

- **Server:** `betterAuth({ database: prismaAdapter(prisma, { provider: "postgresql" }), emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 }, plugins: [bearer(), expo()], trustedOrigins: [...] })`, configured from validated env (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`).
- **Mount:** `@thallesp/nestjs-better-auth` `AuthModule.forRoot({ auth })` exposes Better Auth at **`/api/auth/*`** and registers a **global `AuthGuard`**. Every route is authenticated by default; `@AllowAnonymous()` is used only on health and docs (constitution §VI.1).
- **Ownership:** controllers read `@Session() session` and pass `session.user.id` as `ownerId` into commands/queries; repositories always filter by `ownerId`; foreign ids → `404`.
- **trustedOrigins:** the app scheme (`teamstasks://`) always; `exp://*` and the Metro dev origins only when `NODE_ENV=development`.
- **Mobile:** `createAuthClient({ baseURL, plugins: [expoClient({ scheme: "teamstasks", storagePrefix: "teamstasks", storage: SecureStore })] })`. The generated API client's mutator obtains auth headers from the auth client (`authClient.getCookie()` → `Cookie` header), as recommended by Better Auth for Expo.
- **Rate limiting:** Better Auth's built-in limiter plus `@nestjs/throttler` at 10 req/min per IP on `/api/auth/*`.
- **Logging:** request/response bodies of `/api/auth/*` are redacted in pino; tokens and cookies never logged.

## Consequences

**Positive**

- Production-grade sessions (DB-backed, revocable) with very little code.
- Same identity works for the app (secure-store cookie) and for humans (Bearer).
- The domain stays unaware of auth: it only sees an `ownerId`.

**Negative**

- Dependency on a community Nest adapter; mitigated by pinning and e2e tests on guard behavior (401 without session, public routes reachable).
- Better Auth uses `text` ids for users; our tables reference `users.id` as `text`.

**Neutral**

- Email verification, password reset and social login are out of scope but available as Better Auth options.

## Links

- [Spec 001 — Auth](../../specs/001-auth/spec.md) · [API contracts — Identity](../api-contracts.md#identity--apiauth)
- Better Auth: https://www.better-auth.com/docs · Expo integration: https://www.better-auth.com/docs/integrations/expo
- NestJS integration: https://github.com/ThallesP/nestjs-better-auth
