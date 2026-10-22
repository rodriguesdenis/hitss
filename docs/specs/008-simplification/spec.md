# 008 — Simplification

- **Decision:** [ADR-0020](../../architecture/adr/0020-simplify-architecture-for-the-hiring-test.md) · **Status:** Approved (user, 2026-10-22) · **Priority:** MUST (before presenting the submission)

## Problem

The backend meets every MUST requirement of the brief, but a reviewer must read through CQRS buses, cross-module contracts, a CLS unit of work with two-phase events, cookie/CSRF guards, ETag preconditions and custom telemetry code before reaching the domain. For a two-resource CRUD brief, that reading cost hides the parts that matter.

## Goals / Non-goals

**Goals**

- Every brief requirement still met, with the same public behaviour except the items listed under "Contract changes".
- A request path a reviewer can follow from controller to SQL in a few minutes: controller → use case → entity/repository → Prisma.
- Four layers and the dependency rule still enforced by tooling.
- Fewer runtime dependencies and less custom infrastructure code.
- Fewer documents: README, about six essential ADRs and one architecture document; process material kept but optional.

**Non-goals**

- New features, or COULD items that were deferred (idempotency keys, SigNoz profile, k6, mutation testing).
- Changes to the database schema or the seed data.
- The mobile app (next phase).

## Requirements

- **R-1 (brief contract unchanged).** Team and task CRUD, list pagination metadata, `teamId` / `status` / `search` filters, sort, title ≥ 3 validation, owner isolation (another user's resource → `404`), the `{ data, meta }` / `{ error }` envelopes, the seed (3 teams, 10 tasks), `docker compose up` and `/docs` behave as today.
- **R-2 (green on every PR).** Each 008 PR keeps the unit, integration and e2e suites for the brief contract green. Suites that only test a removed mechanism are deleted in the same PR as the mechanism.
- **R-3 (layering).** Domain code imports no framework; use cases depend on repository abstractions; controllers call use cases only; the dependency-cruiser rules are updated to the new paths and still fail on violations.
- **R-4 (security floor).** Every `/api/v1/*` route except health needs a valid Bearer token; owner scoping on every query; validation whitelist; one global per-IP throttler plus Better Auth's limiter; secrets only from the environment; redacted logs.
- **R-5 (operability floor).** JSON logs with request id and trace id; `/health/live` and `/health/ready`; OTLP export only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; fail fast on invalid config and on an unreachable database at boot.

## Contract changes (intended)

| Before                                                                                   | After                                                                                     |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/api/v1/*` accepts the session cookie or a Bearer token                                 | Bearer token only; a cookie alone → `401`                                                 |
| `403 CSRF_REJECTED`, `415 UNSUPPORTED_MEDIA_TYPE`                                        | Removed (no cookie auth on the business API; a non-JSON body fails validation with `400`) |
| `ETag` on single resources; `If-Match` on team `PUT`/`DELETE`; `412 PRECONDITION_FAILED` | Removed; writes are last-write-wins. `version` stays in responses                         |

## Acceptance criteria

- **AC-08.1** Given the e2e suites for teams, tasks, auth, health and docs, when each 008 PR runs CI, then they pass (minus the cases for removed mechanisms, deleted with them).
- **AC-08.2** Given a request to `/api/v1/teams` with only a session cookie, then it answers `401 UNAUTHENTICATED`; with `Authorization: Bearer <token>` it answers as before.
- **AC-08.3** Given a team update or delete with or without `If-Match`, then the header is ignored and no `ETag` or `412` is produced.
- **AC-08.4** Given a team with tasks, when it is deleted, then in one database transaction the team is soft-deleted and its `task_teams` rows are removed; if either step fails, neither is applied.
- **AC-08.5** Given the API source, then it has no dependency on `@nestjs/cqrs`, `nestjs-cls` or `@nestjs-cls/*`, and no `contracts/` folders.
- **AC-08.6** Given the dependency-cruiser rules, when a domain file imports a framework or a module imports another module's internals other than its exported service, then `pnpm arch` fails.
- **AC-08.7** Given no `OTEL_EXPORTER_OTLP_ENDPOINT`, then the API exports no telemetry and still logs JSON with `reqId` and `traceId`; given the variable, then traces are exported over OTLP.
- **AC-08.8** Given the CI workflow, then its required gate is lint, typecheck, unit, integration, e2e, build, compose smoke, gitleaks and the dependency audit; the traceability, README and production-readiness doc checks are not part of it.
- **AC-08.10** (addendum) Given the teams and tasks modules, then they have no `domain/policies/`, no `application/views/` and no persistence-mapper files; `TaskDescription`, `TaskTeamIds` and `TeamDescription` are entity validation, not value objects; the OpenAPI document and every e2e answer are unchanged.
- **AC-08.11** (addendum) Given a module, then its own unit, integration and e2e tests are under `src/modules/<m>/tests/`; cross-cutting suites stay in `apps/api/test`; the number of tests per Jest project is unchanged and no test file is built into `dist/`.
- **AC-08.12** (addendum) Given the API source and tests, then they hold no explanatory comments, only functional ones (`eslint-disable`, `@ts-expect-error`, triple-slash, tool pragmas).
- **AC-08.9** Given the docs folder, then the README, the essential ADRs and one architecture document describe the code as it is; specs, features and the traceability matrix are marked as optional process material.

## Out of scope

Rewriting the specs 001–007 or their features. They stay as the historical record; ADR-0020 says which parts are superseded.
