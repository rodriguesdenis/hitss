# 008 — Plan

- **Spec:** [spec.md](spec.md) · **Decision:** [ADR-0020](../../architecture/adr/0020-simplify-architecture-for-the-hiring-test.md)
- **Principle:** refactor in small PRs, each leaving `main` green (the brief's e2e contract never breaks). Behaviour changes only where the spec lists them.

## Target tree (`apps/api/src`)

```
main.ts · app.module.ts · app.setup.ts · instrumentation.ts
config/                                   # validated env (unchanged, minus removed variables)
seed/                                     # unchanged
shared/
├── domain/                               # entity.base.ts, value-object.base.ts, domain-error.ts
├── infrastructure/prisma/prisma.service.ts (+ prisma.module.ts, database-probe.ts)
├── http/
│   ├── envelope.interceptor.ts
│   ├── exception.filter.ts               # + per-module error tables registered by each module
│   ├── pagination-query.dto.ts · page-meta.ts · sort.ts
│   ├── current-user.decorator.ts · public.decorator.ts · raw-response.decorator.ts
│   ├── parse-uuid.pipe.ts · validation.pipe.ts
│   └── openapi/                          # envelope / error helpers for @nestjs/swagger
└── observability/                        # logger config (pino), request id, redaction
modules/
├── identity/                             # Better Auth (Bearer), auth guard, throttler, client IP
├── health/                               # live / ready
├── teams/
│   ├── domain/{entities/team.entity.ts, value-objects/*.vo.ts, errors/team.errors.ts, repositories/team.repository.ts}
│   ├── application/{use-cases/{create,list,get,update,delete}-team.use-case.ts, ports/team.read-model.ts}
│   ├── presentation/http/{teams.controller.ts, dto/, presenters/team.presenter.ts}
│   ├── infrastructure/persistence/{team.prisma-repository.ts, team.persistence-mapper.ts, team.prisma-read.ts}
│   ├── team-lookup.service.ts            # exported: live team summaries + missing ids, for tasks
│   └── teams.module.ts                   # exports TeamLookup only
└── tasks/                                # same shape + domain/policies/, application/views/; injects TeamLookup
```

Reads (lists with filters, search, sort, counts) stay as SQL in the persistence layer behind `application/ports/<x>.read-model.ts` (views and pages), implemented by `<x>.prisma-read.ts`; view and page types stay out of the domain. (Amended in T-008-09: the read port was kept in both modules, Maestro decision on #96.)

## Removals and where they happen

| Removal                                                                                                                                  | Files / packages                                                                                                                                                                                                                                                                                                                                                                                                   | Task     |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Cookie auth on `/api/v1`, `CsrfGuard`, Origin checks, `JsonBodyGuard` (`415`), cookie scheme in OpenAPI                                  | `identity/presentation/csrf.guard.ts`, `shared/presentation/guards/json-body.guard.ts`, OpenAPI cookie scheme, their specs/e2e cases; the auth guard accepts Bearer only on `/api/v1`                                                                                                                                                                                                                              | T-008-02 |
| Sanitizing exporter, metric views, `@Traced` + guard spec, diag logger, telemetry lifecycle/shutdown, task metrics port/adapter/handlers | `shared/observability/telemetry/*`, `shared/observability/tracing/*`, `tasks/application/events/record-task-metrics.handler.ts`, `tasks/application/ports/task-metrics.ts`, OTel metric/exporter packages not needed by auto-instrumentation; `instrumentation.ts` reduced                                                                                                                                         | T-008-03 |
| ETag, `If-Match`, `412`, retry-once                                                                                                      | `EtagInterceptor`, `@IfMatch`, `ExpectedVersion`, `assertVersion`, `ConcurrencyConflict` mapping; repositories update by `id` + `owner_id` (version still incremented as data)                                                                                                                                                                                                                                     | T-008-04 |
| CQRS in teams, contracts, QueryBus adapters                                                                                              | teams commands/queries/handlers → use cases; `teams/contracts/`; `GetTeamSummaries` → `TeamLookup` service                                                                                                                                                                                                                                                                                                         | T-008-05 |
| CQRS in tasks, unit of work, two-phase events, advisory lock                                                                             | tasks commands/queries/handlers → use cases; `tasks/contracts/`; `TeamDirectory` adapter → `TeamLookup`; `CountTasksByTeam` → a method on the tasks repository called by the team use cases through an exported `TaskCounts` service, or a SQL join in the teams read; `DeleteTeam` = one `prisma.$transaction` (soft delete + `DELETE FROM task_teams WHERE team_id = $1`); `nestjs-cls`, `@nestjs-cls/*` removed | T-008-06 |
| `@nestjs/cqrs`, shared leftovers (UnitOfWork, DomainEventPublisher, in-transaction handler), old dependency-cruiser rules                | packages, `shared/application/*` not used any more, `.dependency-cruiser.cjs` rewritten for the new paths with meta-test fixtures                                                                                                                                                                                                                                                                                  | T-008-07 |
| Doc checks in the CI gate                                                                                                                | traceability `--require-tests`, README doc-check, production-readiness checks out of `ci-success` (kept as optional local scripts)                                                                                                                                                                                                                                                                                 | T-008-08 |
| Docs surplus                                                                                                                             | README, ~6 essential ADRs, one architecture document; others marked superseded or moved to `docs/process/`                                                                                                                                                                                                                                                                                                         | T-008-09 |

## Cross-module dependency after T-008-06

Tasks needs live team summaries (chips, unknown-team check); Teams needs task counts per team. To avoid a module import cycle:

- `TeamsModule` exports `TeamLookup` (summaries, missing ids). `TasksModule` imports `TeamsModule`.
- `taskCount` is computed in the teams read query with a `LEFT JOIN` / sub-select on `task_teams` + `tasks` (active only). It is a read of shared tables inside one database, accepted by ADR-0020; this avoids `TasksModule` → `TeamsModule` → `TasksModule`.
- dependency-cruiser (T-008-07): a module may import another module only through its exported service file (`modules/<b>/<b>-lookup.service.ts`) and its `<b>s.module.ts`.

## Traceability during the refactor

Removing guards and preconditions deletes tests named after 001/002 acceptance criteria (CSRF, `415`, `If-Match`/`412`). While `traceability --require-tests` is still in the gate, that would fail CI. Therefore **T-008-08 lands first** (right after T-008-01, independent of the code tasks); afterwards the matrix is informational. Each removal PR also marks the affected acceptance criteria in its spec as "Superseded by 008" (one line per criterion), so the record stays honest.

## PR order

```
T-008-01 (ADR + spec)
   ├── T-008-08 (CI gate)          ← first, so removals do not trip traceability
   ├── T-008-02 (Bearer-only)  ┐ parallel
   ├── T-008-03 (observability)┘
   └── T-008-04 → T-008-05 → T-008-06 → T-008-07
T-008-09 (docs) last
```

## Test approach

- Unit: entities, value objects and use cases with in-memory repositories (the existing contract suites move with the repositories).
- Integration: Prisma repositories on Testcontainers, including the `DeleteTeam` transaction (fail the second statement → nothing applied, AC-08.4).
- e2e: the existing suites for the brief contract keep passing; cases for removed mechanisms are deleted with them; new cases for AC-08.2 (cookie alone → `401`) and AC-08.3 (`If-Match` ignored).
- Compose smoke: unchanged, plus the telemetry check switched to "no export without the endpoint".

## Risks

| Risk                                        | Mitigation                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| A large move PR is hard to review           | One module per PR (05, 06); moves first, behaviour unchanged, then deletions |
| Stale link to a soft-deleted team (no lock) | Reads ignore deleted teams; documented in ADR-0020                           |
| Losing lost-update protection               | Accepted (ADR-0020); `version` kept                                          |
