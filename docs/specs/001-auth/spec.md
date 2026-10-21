# 001 — Authentication, sessions and ownership

- **Epic:** [EP-01 Identity & Access](../../product/epics/EP-01-identity-and-access.md) · **Status:** Draft · **Priority:** MUST for sign-in, session check, authentication-required, owner isolation and the demo account (US-01.2, 01.3, 01.4, 01.5, 01.6, 01.8 — [constitution VI](../../constitution.md)); COULD for sign-up and abuse protection (US-01.1, 01.7)

## Problem

Teams and tasks are personal work data. Without identity, anyone who can reach the API can read and change everything. Without ownership rules, a valid user could read another user's data just by guessing ids (broken object-level authorization). The evaluator also needs to try the product immediately, without first creating data.

## Goals / Non-goals

**Goals**

- A person can create an account and sign in from the mobile app and from scripted clients (cURL, API collections).
- Every business endpoint is private by default; the public surface is explicit and minimal (health checks, API docs, authentication itself).
- A user only ever sees and changes their own data. Another user's resource is indistinguishable from a nonexistent one.
- Authentication endpoints resist credential stuffing and brute force; the business API resists abuse.
- A known demo account exists in every fresh environment.

**Non-goals**

- Email verification, password reset, social/OAuth sign-in, MFA, passkeys.
- Roles, permissions or sharing between users.
- Managing a user's list of active sessions or devices.

## Personas

- **Marina** — team lead, uses the mobile app (see [vision](../../product/vision.md#persona)).
- **Evaluator** — uses cURL / an API collection and the demo account.
- **Rafael** — another user, used to prove isolation.

## User stories

### US-01.1 — Sign up with email and password (`COULD`)

As Marina, I want to create an account with my name, email and a password, so that my teams and tasks are kept private to me.

**Acceptance criteria**

- **AC-01.1.1** Given an email not yet registered, when I sign up with a valid name, email and password, then my account is created, I am signed in immediately (a session is issued), and the response contains my id, name and email — never my password or any secret derived from it.
- **AC-01.1.2** Given an email already registered (compared case-insensitively), when I sign up with it, then sign-up is rejected, no second account is created, and the existing account's password is unchanged.
- **AC-01.1.3** Given a password, when I sign up, then it is accepted only if its length is between 8 and 128 characters inclusive (7 and 129 are rejected; 8 and 128 are accepted).
- **AC-01.1.4** Given a malformed email (e.g. without `@` or without a domain), when I sign up, then sign-up is rejected and no account is created.
- **AC-01.1.5** Given a name that is missing, blank, or longer than 100 characters after trimming, when I sign up, then sign-up is rejected; a name of 1–100 characters is accepted and stored trimmed.
- **AC-01.1.6** Given I sign up with an email containing upper-case letters, when the account is created, then the email is stored in lower case and I can later sign in using any letter case.

### US-01.2 — Sign in (`MUST`)

As Marina, I want to sign in with my email and password, so that I can reach my data from my phone.

**Acceptance criteria**

- **AC-01.2.1** Given an existing account, when I sign in with the correct email and password, then a session is issued both as a session cookie and as a bearer token, and the response contains my user data without any secret.
- **AC-01.2.2** Given an existing account, when I sign in with a wrong password, then sign-in is rejected with a generic "invalid email or password" outcome and no session is issued.
- **AC-01.2.3** Given no account exists for an email, when I sign in with it, then the outcome is identical to AC-01.2.2 (same status, same code, same message), so account existence is not revealed.
- **AC-01.2.4** Given I signed in and received a bearer token, when I call a business endpoint with that token, then the request is processed as me.
- **AC-01.2.5** Given I signed in and received a session cookie, when I call a business endpoint with that cookie only, then the request is processed as me.
- **AC-01.2.6** Given an email with surrounding spaces or mixed case, when I sign in, then it is trimmed and normalized and matches my account; a password with leading or trailing spaces is **not** trimmed and is compared exactly.
- **AC-01.2.7** Given no account exists for an email, when I sign in with it, then a password hash is still computed (observable in a test by spying on the hasher), so response time does not reveal whether the account exists; the response is the same as for a wrong password.
- **AC-01.2.8** Given a cross-origin sign-in request (untrusted `Origin`), when it is sent, then it is rejected and no session is issued.

### US-01.3 — Sign out (`MUST`)

As Marina, I want to sign out, so that nobody using my phone afterwards can act as me.

**Acceptance criteria**

- **AC-01.3.1** Given I am signed in, when I sign out, then that session is revoked and any later request using its token or cookie is treated as unauthenticated.
- **AC-01.3.2** Given I am signed in on two devices, when I sign out on one, then the session on the other device remains valid.
- **AC-01.3.3** Given I am not signed in, when I sign out, then the request does not fail with a server error and no existing session (mine or anyone's) is affected.

### US-01.4 — Get the current session (`MUST`)

As the mobile app, I want to know whether the stored session is still valid and who it belongs to, so that I can decide between the sign-in screen and the home screen.

**Acceptance criteria**

- **AC-01.4.1** Given a valid session, when the current session is requested, then the response contains the user (id, name, email) and the session's expiry time.
- **AC-01.4.2** Given no credentials, when the current session is requested, then the response states there is no active session (an empty result, not a server error).
- **AC-01.4.3** Given a session whose expiry time has passed, when it is used for the current session or a business endpoint, then it is treated as no session / unauthenticated.
- **AC-01.4.4** Given a session is used after more than 1 day since it was last renewed and before it expires, when it is used, then its expiry is extended to 7 days from now (sliding session).
- **AC-01.4.5** Given the database fails while an authentication endpoint (`/api/auth/*`) is handling a request, then the response is a generic error that contains no Prisma, SQL or stack-trace text (the authentication component's `onAPIError` is configured).

### US-01.5 — Business API requires authentication (`MUST`, foundational)

As Marina, I want every operation on teams and tasks to require my session, so that nobody can read or change my data anonymously.

**Acceptance criteria**

- **AC-01.5.1** Given no credentials, when any business endpoint is called (any method), then it is rejected with `401 UNAUTHENTICATED` in the standard error envelope, and no data is read or changed.
- **AC-01.5.2** Given a malformed, forged, revoked or expired token, when any business endpoint is called, then it is rejected exactly as in AC-01.5.1.
- **AC-01.5.3** Given no credentials, when the health checks are called, then they respond normally (they are public).
- **AC-01.5.4** Given the full list of endpoints exposed by the API, then every endpoint not explicitly declared public requires authentication, and the declared-public inventory is exactly: health checks, the authentication endpoints (`/api/auth/*`) and — only when `DOCS_ENABLED` is true — the API documentation. (A newly added endpoint is private unless marked otherwise.)
- **AC-01.5.5** Given no credentials, when a business endpoint is called with the id of a resource that exists, then the response is the same `401` as for a nonexistent id (authentication is checked before anything else, so existence is not revealed).
- **AC-01.5.6** Given a raw (unsigned) session token is sent as a bearer token, when any business endpoint is called, then it is rejected with `401 UNAUTHENTICATED` (bearer tokens must carry a valid signature).
- **AC-01.5.7** Given a bearer token of user A and a different session cookie of user B in the same request, when a business endpoint is called, then the request is processed as A (bearer wins).
- **AC-01.5.8** Given a request authenticated by cookie only (no `Authorization` header) with an unsafe method (`POST`, `PUT`, `PATCH`, `DELETE`) on `/api/v1`, when its `Origin` (or `Referer`) is present and not a trusted origin, or `Sec-Fetch-Site` is `cross-site`, then it is rejected with `403 CSRF_REJECTED` and nothing changes.
- **AC-01.5.9** Given a cookie-authenticated unsafe request with a body, when its `Content-Type` is not `application/json`, then it is rejected with `415 UNSUPPORTED_MEDIA_TYPE`.
- **AC-01.5.10** Given a request authenticated by bearer token, when it carries no `Origin`, or an untrusted one, then the CSRF checks do not apply (bearer tokens are not ambient credentials).

### US-01.6 — My data is isolated from other users (`MUST`, foundational)

As Marina, I want other users to be unable to see or change my teams and tasks, and vice-versa, so that my work stays private.

**Acceptance criteria**

- **AC-01.6.1** Given Rafael owns teams and tasks, when I list teams or tasks, then none of Rafael's items appear and totals count only my items.
- **AC-01.6.2** Given Rafael owns a resource, when I read it by id, then the response is identical to reading a nonexistent id (`404` with the resource's not-found code).
- **AC-01.6.3** Given Rafael owns a resource, when I update or delete it by id, then the response is identical to a nonexistent id and Rafael's resource is unchanged.
- **AC-01.6.4** Given any create or update request, when it includes an owner field (or any field naming a user: `ownerId`, `owner_id`, `userId`, `owner` as an object), then the request is rejected as invalid; the owner is always the signed-in user.
- **AC-01.6.6** Given any create or update request, when it includes `updatedAt`, `deletedAt`, `__proto__` or `constructor` (or any other field the API does not declare), then it is rejected as invalid on both create and update, and nothing is written.
- **AC-01.6.5** Given Rafael owns a team, when I assign it to one of my tasks or filter my tasks by it, then it behaves as an unknown team (detailed in [003-tasks](../003-tasks/spec.md)).

### US-01.7 — Protection against brute force and abuse (`COULD`)

As Marina, I want repeated sign-in attempts and abusive traffic to be throttled, so that my password cannot be guessed and the service stays available.

**Acceptance criteria**

- **AC-01.7.1** Given 10 requests to one credential endpoint (sign-up, sign-in or sign-out — each counted separately, not combined) from the same client address within 1 minute, when an 11th is made to that endpoint within that minute, then it is rejected as "too many requests" with a hint of how many seconds to wait, and it does not reach credential checking.
- **AC-01.7.2** Given a client was throttled on authentication, when the window has passed, then its requests are accepted again.
- **AC-01.7.3** Given a signed-in user made 100 business requests within 1 minute, when a 101st is made within that minute, then it is rejected with `429 RATE_LIMITED` in the error envelope and a `Retry-After` value.
- **AC-01.7.4** Given Marina is throttled on the business API, when Rafael makes requests, then Rafael is not affected.
- **AC-01.7.5** Given health checks are called frequently (e.g. by the container orchestrator), then they are never throttled.
- **AC-01.7.6** Given a client is throttled on credential requests, when it retries while claiming a different client address through request headers it controls (including `x-tt-client-ip`, `X-Forwarded-For`), then it is still throttled (the limit cannot be bypassed by spoofing). The resolved client address is set by the API itself from the connection (or from the trusted proxies' header when `TRUSTED_PROXIES` is configured), never from the incoming request.
- **AC-01.7.11** Given `TRUSTED_PROXIES` lists the CIDR of the connecting proxy, when that proxy forwards a request with the original client address in its forwarded header, then that address is used for limiting (positive case): two clients behind the proxy are throttled independently. A forwarded header from a connection outside the configured CIDRs is ignored (AC-01.7.6).
- **AC-01.7.8** Given two clients with different addresses, when client A is throttled on credential requests, then client B is not throttled (limits are independent per address). The test asserts the resolved address and must not rely on the authentication component's fixed address under `NODE_ENV=test`.
- **AC-01.7.9** Given anonymous requests from one address, when they exceed the per-address API limit (`RATE_LIMIT_IP_MAX`, default 300 per minute) before authentication, then further requests get `429 RATE_LIMITED`; this limit is checked before the authentication guard, and the per-user limit (AC-01.7.3) after it.
- **AC-01.7.10** Given a request to `/api/auth/*` with a body larger than 16 kB, then it is rejected with `413` before any password hashing happens.
- **AC-01.7.7** Given the app checks the current session frequently, when it makes up to 100 session checks per minute from one address, then they are not throttled by the stricter credential limit; the 100th is accepted and the 101st within the minute gets `429`.

### US-01.8 — Demo account for evaluation (`MUST`, supports MUST seeds)

As the evaluator, I want a ready-made account with sample data, so that I can try the app and the API within a minute of starting it.

**Acceptance criteria**

- **AC-01.8.1** Given a freshly started environment, when I sign in with `demo@teams-tasks.dev` / `Demo@1234`, then sign-in succeeds.
- **AC-01.8.2** Given the seed has already run, when it runs again, then there is still exactly one demo account, with the same id and the same password.
- **AC-01.8.3** Given I am signed in as the demo user, then I own the seeded sample data (3 teams — see [002-teams](../002-teams/spec.md); 10 tasks — see [003-tasks](../003-tasks/spec.md)).
- **AC-01.8.4** Given `SEED_DEMO` is false, or `APP_ENV` is `production`, when the seed runs, then the demo account and its data are not created (`SEED_DEMO` defaults to true in the Docker Compose setup).
- **AC-01.8.5** Given the API starts with `APP_ENV=production` and a configuration that breaks any of these rules, then startup fails with a message naming the offending variable: `BETTER_AUTH_URL` is not `https`; `CORS_ORIGINS` contains `*`, an `http://` origin or `localhost`; `AUTH_RATE_LIMIT_ENABLED` is false; `APP_SCHEME` is `exp`. Each rule has its own test.
- **AC-01.8.6** Given `APP_ENV=production`, then the API documentation is not served regardless of `DOCS_ENABLED` (`DOCS_ENABLED` defaults to true otherwise).

## Business rules

| ID       | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-01.1  | An account is identified by its email, unique case-insensitively and stored in lower case.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| BR-01.2  | Password length is 8–128 characters. No composition rules (length-based policy). Passwords are only ever stored as a slow, salted hash.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| BR-01.3  | Name is required, trimmed, 1–100 characters.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| BR-01.4  | A session lasts 7 days and is renewed (sliding) when used more than 1 day after its last renewal. Signing out revokes only the current session.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| BR-01.5  | A session can be presented as a bearer token or as a session cookie; both are equivalent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| BR-01.6  | Every business endpoint is private unless explicitly declared public. Public: health checks, authentication endpoints, and API documentation only while `DOCS_ENABLED` is true (default true; forced false when `APP_ENV=production`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| BR-01.7  | Every read and write is scoped to the signed-in user (the **owner**). The owner is never taken from the request body or query.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| BR-01.8  | Another user's resource is reported exactly like a nonexistent one (`404`), never `403`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| BR-01.9  | Each credential endpoint (sign-up, sign-in, sign-out): max 10 requests per minute per client address, counted per endpoint. Other authentication endpoints (current session): max 100 per minute per client address. Business API: max 100 requests per minute per user (`RATE_LIMIT_MAX`) and max 300 per minute per client address before authentication (`RATE_LIMIT_IP_MAX`). Health checks: unlimited. The client address is resolved by the API from the connection, or from the proxy header only when `TRUSTED_PROXIES` CIDRs are configured; client-supplied headers are never trusted. Limits are configurable per environment. Docker Desktop / WSL NAT may make all host traffic share one address; document this caveat. |
| BR-01.10 | Credentials, tokens, session ids and password hashes never appear in responses (other than the token issued at sign-in/up) or in logs. Request and response bodies are never logged; `authorization`, `cookie`, `set-cookie`, `set-auth-token` headers and `password`, `newPassword`, `currentPassword`, `token` body fields (nested at any depth) are redacted; query strings of `/api/auth/*` URLs are stripped; database error text never reaches a response.                                                                                                                                                                                                                                                                      |
| BR-01.11 | Failed sign-in does not reveal whether the email is registered.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Edge cases

| Case                                                                   | Expected                                                                                                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Email with surrounding spaces or mixed case on sign-in                 | Normalized; matches the account.                                                                                                   |
| Password of exactly 8 / 128 characters, or containing Unicode / spaces | Accepted; compared exactly (no trimming of passwords).                                                                             |
| Same token sent both as bearer and as a (different) cookie             | Bearer token takes precedence; the request is authenticated as the bearer token's user.                                            |
| Bearer header present but empty / wrong scheme (`Basic …`)             | Unauthenticated.                                                                                                                   |
| Session revoked while a request is in flight                           | That request completes; the next is unauthenticated.                                                                               |
| Demo password changed manually, then seed re-runs                      | Seed restores the documented demo password (environment is for evaluation).                                                        |
| Sign-up for an existing email                                          | Rejected — this necessarily reveals the email is registered; accepted risk, mitigated by rate limiting (see open question Q-01.2). |

## Out of scope

- Email verification, password reset and change, account deletion, profile editing.
- Social / OAuth, magic link, passkeys, MFA.
- Session list / remote sign-out of other devices.
- Account lockout after N failures (rate limiting is the chosen control).
- Mobile sign-in / sign-up screens (in [004-mobile-app](../004-mobile-app/spec.md)).

## Open questions

| ID     | Question                                                                                                                                                                                               | Proposed answer                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Q-01.1 | Authentication endpoints respond in the authentication component's native format, not the `{ error: { code, message } }` envelope (constitution IV.2). Accept as a documented exception, like health?  | Yes — document in the API contract; the app uses the component's own client for these routes.                                   |
| Q-01.2 | Sign-up reveals that an email is registered. Acceptable without email verification?                                                                                                                    | Yes for this project; rate limiting mitigates enumeration. Production note: verification-based sign-up.                         |
| Q-01.3 | The throttling response on authentication endpoints follows the component's native format (`429` with a retry hint) rather than `RATE_LIMITED` + `Retry-After`. Acceptable?                            | Yes, under the same exception as Q-01.1.                                                                                        |
| Q-01.4 | The contract states "auth endpoints: 10 req/min per IP". Applying it to the session check would throttle the app's normal start-up/refresh. Narrow the strict limit to credential endpoints (BR-01.9)? | Yes — proposed here; the API contract should be updated accordingly.                                                            |
| Q-01.5 | The domain model types `ownerId` as UUID, while the data model stores `users.id` as text (identity component's default). Which is it?                                                                  | Store as text (identity component's schema) but generate UUID-formatted user ids, so `ownerId` is a UUID everywhere — see plan. |
