# EP-01 — Identity & Access

- **Priority:** `MUST` for the access-control core (US-01.2, 01.3, 01.4, 01.5, 01.6, 01.8 — the product requires sign-in and owner scoping, [constitution VI](../../constitution.md)); `COULD` for sign-up and abuse protection (US-01.1, 01.7). Every `MUST` feature (teams, tasks) is scoped to its owner and relies on this epic.
- **Bounded context:** Identity (generic subdomain), see the [domain model](../../architecture/overview.md#2-modules)
- **Spec:** [001-auth](../../specs/001-auth/spec.md)

## Goal

A person can create an account, sign in from the mobile app or a command line, and see and change **only their own** teams and tasks.

## Business value

| For               | Value                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| End user (Marina) | Her work stays private and follows her across devices and sessions.                                                                                                               |
| Evaluator         | Shows production-grade practices: authentication on by default, ownership isolation (no BOLA), brute-force protection, and a seeded demo account so the app can be tried at once. |
| Other epics       | Gives every request a trusted **owner**, so EP-02 and EP-03 never deal with credentials.                                                                                          |

## Scope

- Sign up with name, email and password; sign in; sign out; get the current session.
- Sessions usable by the mobile app (secure token storage) and by scripted clients (bearer token).
- Every business endpoint requires authentication by default; only health checks (plus docs and auth) are public.
- Ownership isolation: another user's resource behaves exactly like a nonexistent one.
- Rate limiting: stricter on authentication, per user on the business API.
- Password policy: 8–128 characters.
- Seeded demo account `demo@teams-tasks.dev` / `Demo@1234`.

## Out of scope

- Email verification, password reset, change email or password.
- Social or OAuth sign-in, magic links, passkeys, MFA.
- Roles, permissions, sharing data between users (see [vision](../vision.md#out-of-scope)).
- Account deletion and profile editing.
- Listing or revoking a user's other sessions.

## User stories

| ID      | Title                                    | Priority                                      | Spec                                     |
| ------- | ---------------------------------------- | --------------------------------------------- | ---------------------------------------- |
| US-01.1 | Sign up with email and password          | `COULD`                                       | [001-auth](../../specs/001-auth/spec.md) |
| US-01.2 | Sign in                                  | `MUST`                                        | [001-auth](../../specs/001-auth/spec.md) |
| US-01.3 | Sign out                                 | `MUST`                                        | [001-auth](../../specs/001-auth/spec.md) |
| US-01.4 | Get the current session                  | `MUST`                                        | [001-auth](../../specs/001-auth/spec.md) |
| US-01.5 | Business API requires authentication     | `MUST` (foundational)                         | [001-auth](../../specs/001-auth/spec.md) |
| US-01.6 | My data is isolated from other users     | `MUST` (foundational)                         | [001-auth](../../specs/001-auth/spec.md) |
| US-01.7 | Protection against brute force and abuse | `COULD`                                       | [001-auth](../../specs/001-auth/spec.md) |
| US-01.8 | Demo account for evaluation              | `MUST` (supports the `MUST` seed requirement) | [001-auth](../../specs/001-auth/spec.md) |

## Traceability to the brief

The brief does not mention authentication; the project decision (D5, D34) is that every API route requires it and data is owner-scoped, so the access-control core is `MUST`, while account self-service and abuse protection stay `COULD`. It supports these brief items:

| Brief item                                     | How                                                         |
| ---------------------------------------------- | ----------------------------------------------------------- |
| "Seeds/fixtures para facilitar avaliação"      | US-01.8: the seeded data belongs to a known demo account.   |
| "O que faria diferente em produção: segurança" | US-01.5, US-01.6, US-01.7 are built in, not just described. |

## Success criteria

- All 38 `MUST` acceptance criteria of 001 (US-01.2–01.6, 01.8) are covered by ≥ 1 automated scenario (+ 17 `COULD` ones: US-01.1, 01.7).
- 100 % of `/api/v1` routes other than health reject unauthenticated requests. This is checked automatically by a route-inventory test, not by manual review.
- 0 cross-owner leaks: every read, update and delete test with another user's id returns "not found".
- An evaluator signs in with the demo account within 1 minute of `docker compose up`.
- No credentials, tokens or password hashes appear in API responses or logs (verified by tests and log redaction).

## Dependencies

| On                                                                       | Why                                                             |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| EP-07 (workspace scaffold, Docker Compose)                               | The API app and database must exist before auth can be mounted. |
| [ADR-0007](../../architecture/adr/0007-better-auth.md)                   | Authentication approach.                                        |
| [ADR-0004](../../architecture/adr/0004-prisma-migrations-and-seeding.md) | Identity tables and the demo-user seed.                         |
| EP-04 (mobile)                                                           | Consumes sign-in and sign-up; owns the screens.                 |

| Depended on by | Why                                        |
| -------------- | ------------------------------------------ |
| EP-02, EP-03   | Need a trusted `ownerId` on every request. |

## Risks

| Risk                                                             | Impact                                      | Mitigation                                                                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Auth library response format differs from the API error envelope | Two error styles in the contract            | Document it as an explicit exception for `/api/auth/*` (like health). The app uses the library's client for those routes.       |
| Session handling differs between the mobile app and cURL         | Login works in one client and not the other | Support both cookie and bearer token, with e2e tests for each.                                                                  |
| Rate limiting makes automated tests flaky                        | False failures in CI                        | Limits are configurable by environment. Rate-limit tests run in their own isolated app instance.                                |
| Auth is a COULD but blocks MUST work if it slips                 | MUST features delayed                       | Auth tasks are small and come first. The `CurrentOwner` abstraction lets teams and tasks be built and tested with a fake owner. |
