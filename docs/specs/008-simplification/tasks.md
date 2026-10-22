# 008 — Tasks

Each task is one PR. The brief's e2e contract stays green on every PR. Order: T-008-01, then T-008-08 first (so removals do not trip the traceability gate), T-008-02 and T-008-03 in parallel, T-008-04 → 05 → 06 → 07 in sequence, T-008-09 last.

| ID       | Task                                                                                       | Owner                                  | Depends on | Branch                            |
| -------- | ------------------------------------------------------------------------------------------ | -------------------------------------- | ---------- | --------------------------------- |
| T-008-01 | ADR-0020 and spec / plan / tasks                                                           | software-architect                     | —          | `docs/008-simplification`         |
| T-008-02 | Bearer-only auth on `/api/v1`                                                              | nestjs-specialist                      | 01, 08     | `refactor/008-bearer-only`        |
| T-008-03 | Slim observability                                                                         | observability-sre                      | 01, 08     | `refactor/008-slim-observability` |
| T-008-04 | Remove ETag / `If-Match` / `412`                                                           | nestjs-specialist                      | 01, 08     | `refactor/008-no-etag`            |
| T-008-05 | Teams module to the new layout with use cases                                              | nestjs-specialist                      | 04         | `refactor/008-teams-layout`       |
| T-008-06 | Tasks module to the new layout, `TeamLookup`, single-transaction delete, drop `nestjs-cls` | database-specialist                    | 05         | `refactor/008-tasks-layout`       |
| T-008-07 | Remove `@nestjs/cqrs` and shared leftovers; dependency-cruiser rules for the new paths     | database-specialist or devops-ci       | 06         | `refactor/008-no-cqrs`            |
| T-008-08 | CI gate without the doc / traceability checks                                              | devops-ci                              | 01         | `ci/008-gate`                     |
| T-008-09 | Docs reduction                                                                             | software-architect + observability-sre | 02–08      | `docs/008-reduction`              |

## T-008-01 — ADR and spec

- **Goal:** the decision and its plan are written and approved before code changes.
- **Changes:** `docs/architecture/adr/0020-…md` (new), superseded notes in ADR-0002, 0007, 0013, 0015 and the ADR index; `docs/specs/008-simplification/{spec,plan,tasks}.md`; specs index row.
- **Done when:** ADR-0020 is Accepted and linked from the superseded ADRs; the spec lists the contract changes and acceptance criteria; the plan gives the target tree, removals per task and the PR order.

## T-008-02 — Bearer-only auth

- **Goal:** `/api/v1/*` authenticates with Bearer tokens only (AC-08.2).
- **Changes:** auth guard rejects a cookie-only request on `/api/v1` (`401`); remove `CsrfGuard`, Origin/`Sec-Fetch-Site` checks, `JsonBodyGuard` and the `415` code; remove the cookie security scheme from OpenAPI; delete their specs and e2e cases; mark the affected 001 ACs "Superseded by 008"; update api-contracts (auth row, error table).
- **Done when:** e2e: cookie-only → `401`, Bearer → as before; no CSRF/`415` code left; contract suites green.

## T-008-03 — Slim observability

- **Goal:** pino JSON logs + optional OTLP auto-instrumentation only (AC-08.7).
- **Changes:** `instrumentation.ts` starts the NodeSDK with auto-instrumentations only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (and `OTEL_SDK_DISABLED` is not `true`); remove the sanitizing exporter, metric views, `@Traced` + its guard spec, diag logger, telemetry lifecycle/shutdown, the task metrics port/adapter/handlers and unused OTel packages; keep logger config, request id, redaction, trace id in logs; compose smoke checks "no export without the endpoint".
- **Done when:** unit/e2e green; logs carry `reqId` and `traceId`; with the endpoint set, the smoke sink receives a trace.

## T-008-04 — Remove ETag / `If-Match`

- **Goal:** last-write-wins updates (AC-08.3).
- **Changes:** remove `EtagInterceptor`, `@IfMatch`, `ExpectedVersion`, `assertVersion`, the `ConcurrencyConflict` → `412` mapping and the retry-once loops; repositories update by `id` + `owner_id` and still increment `version`; delete the precondition e2e cases; mark the affected 002/003 ACs "Superseded by 008"; update api-contracts.
- **Done when:** e2e: `If-Match` ignored, no `ETag`, no `412`; contract suites green.

## T-008-05 — Teams module, new layout

- **Goal:** teams follows ADR-0020's layout with use cases (no CQRS inside teams).
- **Changes:** `domain/{entities,value-objects,errors,repositories}`, `application/use-cases/*`, `presentation/http/{controller,dto,presenters}`, `infrastructure/persistence/*`; `Team.create()` / `Team.restore()`; `TeamLookup` service exported by `TeamsModule` (summaries, missing ids), and tasks' `TeamDirectory` adapter switched to it (replacing `GetTeamSummariesQuery`); `taskCount` computed in the teams read SQL (replacing `CountTasksByTeamQuery`). The `TeamDeleted` contract and its in-transaction reaction stay until T-008-06.
- **Done when:** teams unit/integration/e2e green; tasks reach teams only through `TeamLookup`; `teams/contracts/` holds only `team-deleted.event.ts` (removed in T-008-06); `TeamsModule` imports nothing from tasks.

## T-008-06 — Tasks module, new layout, single-transaction delete

- **Goal:** tasks follows the layout; `DeleteTeam` is one Prisma transaction (AC-08.4); no `nestjs-cls` (AC-08.5).
- **Changes:** tasks moved like teams; `TeamDirectory` adapter → `TeamLookup`; `DeleteTeam` use case: `prisma.$transaction` soft-deleting the team and deleting its `task_teams` rows; remove the unit of work, two-phase publisher, `@InTransactionHandler`, `OnTeamDeletedHandler`, the advisory lock, `tasks/contracts/` and the `nestjs-cls` packages; integration test for the transaction rollback.
- **Done when:** tasks unit/integration/e2e green, incl. team-delete unassignment; the rollback test passes; no `nestjs-cls` import.

## T-008-07 — Remove `@nestjs/cqrs`, update architecture rules

- **Goal:** no CQRS package or leftover shared abstractions; rules match the new tree (AC-08.5, AC-08.6).
- **Changes:** remove `@nestjs/cqrs` and `CqrsModule`; delete unused `shared/application/*`; rewrite `.dependency-cruiser.cjs` (domain pure; use cases → domain + repositories only; presentation → use cases; persistence → domain; cross-module only through `<b>-lookup.service.ts` / `<b>s.module.ts`) with meta-test fixtures per rule.
- **Done when:** `pnpm arch` and its meta-tests green; no `@nestjs/cqrs` in `package.json`.

## T-008-08 — CI gate

- **Goal:** the gate checks code, not documents (AC-08.8).
- **Changes:** `ci-success` needs lint, typecheck, unit, integration, e2e, build, compose smoke, gitleaks, audit; traceability, README doc-check and production-readiness checks move out (optional local scripts or a non-required job).
- **Done when:** a PR that changes only docs or removes AC-tagged tests passes the gate when the code checks pass.

## T-008-09 — Docs reduction

- **Goal:** the docs describe the code as it is, in few documents (AC-08.9).
- **Changes:** README (how to run, decisions, data model, API summary, tests, production notes); keep about six ADRs current (monorepo, NestJS layering as amended by 0020, PostgreSQL + Prisma, REST + envelope + pagination, Better Auth Bearer, Docker one-command run) and mark the rest superseded or historical; one architecture document replacing overview/domain-model/data-model/api-contracts overlap; specs, features and the traceability matrix marked as optional process material.
- **Done when:** every document left in the main path matches the code; links resolve.
