# 003 — Tasks

Ordered, atomic tasks; **each task = one PR** (Conventional Commits, scope `api`, [ADR-0017](../../architecture/adr/0017-conventional-commits-and-atomic-prs.md)). Every PR: TDD, `pnpm --filter @hitss/api lint typecheck test` green, OpenAPI/client regenerated when the contract changes, scenarios of **Covers** automated, [Definition of Done](../../quality/definition-of-done.md).

Prerequisites from other specs: authenticated `ownerId` decorator and guard (001), `Team` model + `TeamDirectory` + `TeamDeleted` (002), common envelope/filter/`Clock`/`IdGenerator`/`TransactionHost` (002 or 007, whichever lands first).

| ID       | Task                                                                        | Depends on            | Size | Branch                           |
| -------- | --------------------------------------------------------------------------- | --------------------- | ---- | -------------------------------- |
| T-003-01 | Add `tasks`, `task_teams`, `task_status` schema, migration, indexes, CHECKs | 002 schema            | M    | `feat/003-tasks-schema`          |
| T-003-02 | Implement task value objects (TDD)                                          | —                     | S    | `feat/003-task-value-objects`    |
| T-003-03 | Implement `Task` aggregate, events, errors, overdue policy (TDD)            | 02                    | M    | `feat/003-task-aggregate`        |
| T-003-04 | Add `TaskRepository` port + Prisma adapter                                  | 01, 03                | M    | `feat/003-task-repository`       |
| T-003-05 | Add `TeamDirectory` port + adapter to Teams                                 | 002 `TeamDirectory`   | S    | `feat/003-team-directory`        |
| T-003-06 | Add read model, view assembler and `GET /tasks/:id`                         | 04, 05                | M    | `feat/003-get-task`              |
| T-003-07 | Add `CreateTask` command and `POST /tasks`                                  | 06                    | M    | `feat/003-create-task`           |
| T-003-08 | Add `ListTasks` with `teamId` / `status` filters and pagination             | 06                    | M    | `feat/003-list-filters`          |
| T-003-09 | Add search and sorting to `ListTasks` + query-plan check                    | 08                    | M    | `feat/003-list-search-sort`      |
| T-003-10 | Add `UpdateTask` command and `PUT /tasks/:id`                               | 07                    | M    | `feat/003-update-task`           |
| T-003-11 | Add `ChangeTaskStatus` command and `PATCH /tasks/:id/status`                | 06                    | S    | `feat/003-change-status`         |
| T-003-12 | Add `DeleteTask` command and `DELETE /tasks/:id`                            | 06                    | S    | `feat/003-delete-task`           |
| T-003-13 | React to `TeamDeleted` (unassign team, bump versions)                       | 04, 002 `TeamDeleted` | S    | `feat/003-team-deleted-reaction` |
| T-003-14 | Expose `CountTasksPerTeam` query for team `taskCount`                       | 06                    | S    | `feat/003-task-counts-per-team`  |
| T-003-15 | Seed 10 demo tasks                                                          | 01, 002 seed          | S    | `feat/003-seed-tasks`            |
| T-003-16 | Emit task metrics and span attributes                                       | 07, 11, 12            | S    | `feat/003-task-observability`    |
| T-003-17 | Add ETag / If-Match optimistic concurrency (COULD)                          | 10, 11, 12            | M    | `feat/003-task-if-match`         |
| T-003-18 | Add Idempotency-Key on `POST /tasks` (COULD)                                | 07                    | S    | `feat/003-idempotent-create`     |

MUST work (01–15) is complete and demo-able before any COULD task (17–18) starts (constitution IX.1). 16 is cross-cutting and can run in parallel after 12.

---

## T-003-01 — Add `tasks`, `task_teams`, `task_status` schema, migration, indexes, CHECKs

- **Goal:** persistence for Task Management exactly as [data-model.md](../../architecture/data-model.md) + the plan's proposed `tasks_owner_created_idx`.
- **Changes:** `apps/api/prisma/schema.prisma` (`TaskStatus`, `Task`, `TaskTeam`, back-relations on `User`/`Team`); `prisma/migrations/<ts>_create_tasks/migration.sql` (generated + raw SQL: `pg_trgm`, partial indexes, GIN, CHECKs); `docs/architecture/data-model.md` only if the proposed index is approved.
- **Covers:** foundation (no scenario); CHECK constraints back BR-03.1, BR-03.5.
- **Done when:** `prisma migrate deploy` on an empty DB succeeds; `\d tasks` shows all indexes and CHECKs; a follow-up `prisma migrate dev --create-only` produces an empty migration (no drift); integration smoke inserting a row violating each CHECK fails.

## T-003-02 — Implement task value objects (TDD)

- **Goal:** invalid task values cannot be constructed.
- **Changes:** `modules/tasks/domain/{task-title,task-description,task-status,due-date,task-team-ids}.ts` + `*.spec.ts`; errors `InvalidTaskTitle`, `InvalidDueDate`, `TooManyTeams`.
- **Covers:** @AC-03.1.2 @AC-03.1.3 @AC-03.1.5 @AC-03.1.6 (count) — outline rows at unit level.
- **Done when:** title 0/2/3/120/121 (after trim), description 2000/2001, all due-date rows, team ids 0/1/10/11 and order-insensitive equality tested; 100 % branch coverage on VOs; no framework imports (dependency-cruiser).

## T-003-03 — Implement `Task` aggregate, events, errors, overdue policy (TDD)

- **Goal:** lifecycle rules live in the aggregate.
- **Changes:** `domain/task.ts`, `domain/overdue.policy.ts`, `domain/events/*`, `domain/errors/{task-not-found,unknown-teams,concurrency-conflict}.error.ts` + specs.
- **Covers:** @AC-03.1.1 @AC-03.1.4 @AC-03.9.4 @AC-03.9.5 @AC-03.10.1 @AC-03.10.2 @AC-03.10.3 @AC-03.10.5 @AC-03.13.2 @AC-03.13.4 @AC-03.14.1 @AC-03.14.2 @AC-03.14.3 (unit level).
- **Done when:** the 9-row transition matrix passes (status, version, `completedAt`, event emitted or not); edit no-op leaves version/`updatedAt`; `unassignTeam` bumps version only when the team was assigned; overdue table passes with fixed today; Stryker ≥ 80 % on `domain/`.

## T-003-04 — Add `TaskRepository` port + Prisma adapter

- **Goal:** persist the aggregate atomically with its team links and optimistic version check.
- **Changes:** `application/ports/task.repository.ts`; `infrastructure/prisma-task.repository.ts`, `task.mapper.ts`; integration specs (Testcontainers).
- **Covers:** @AC-03.9.2 (team set replace), @AC-03.11.1 (soft delete invisible to `findById`), @AC-03.12.1 (owner scoping), @AC-03.15.3 (race: two saves of v3 → exactly one wins).
- **Done when:** `save` inserts/updates `tasks` and diff-syncs `task_teams` in one transaction (`TransactionHost`); update uses `WHERE id, owner_id, version, deleted_at IS NULL` and throws `ConcurrencyConflict` on 0 rows; `findById` / `findByTeam` never return another owner's or deleted rows; round-trip mapping test for every field.

## T-003-05 — Add `TeamDirectory` port + adapter to Teams

- **Goal:** Task Management learns about teams only through a port.
- **Changes:** `application/ports/team-directory.ts` (`findMissing`, `summaries`); `infrastructure/team-directory.adapter.ts`; `tasks.module.ts` imports `TeamsModule`; in-memory fake for handler tests.
- **Covers:** prerequisite for @AC-03.1.6 @AC-03.2.5 @AC-03.12.3.
- **Done when:** integration test: live own team → found; deleted, foreign and unknown ids → reported missing and excluded from `summaries`; dependency-cruiser forbids `tasks/**` importing `teams/infrastructure/**`.

## T-003-06 — Add read model, view assembler and `GET /tasks/:id`

- **Goal:** first endpoint; the `TaskView` used by every response.
- **Changes:** `application/ports/task.read-model.ts`; `infrastructure/prisma-task.read-model.ts` (`findById`); `application/views/*`; `queries/get-task/*`; `presentation/tasks.controller.ts` (GET), `dto/task.response.dto.ts`, `dto/team-chip.dto.ts`, `task-error.mapper.ts`; e2e spec.
- **Covers:** @AC-03.8.1 @AC-03.8.2 @AC-03.8.3 @AC-03.2.5 (team order) @AC-03.12.1 (view) @AC-03.12.5 (view) @AC-03.14.1 @AC-03.14.2.
- **Done when:** e2e returns the contract shape (teams by name, `isOverdue` with fixed clock); unknown/deleted/foreign → 404 `TASK_NOT_FOUND`; `abc` → 400 field `id`; no session → 401; OpenAPI shows the response schema.

## T-003-07 — Add `CreateTask` command and `POST /tasks`

- **Goal:** capture tasks with validation and team assignment.
- **Changes:** `commands/create-task/*`; `dto/create-task.dto.ts` (+ `IsCalendarDate` validator); controller POST (`201`, `Location`); e2e + handler specs.
- **Covers:** @AC-03.1.1 – @AC-03.1.7, @AC-03.12.3 (create), @AC-03.12.5 (create).
- **Done when:** every create outline row of `tasks.feature` passes at e2e level; `TOO_MANY_TEAMS` precedes `UNKNOWN_TEAMS`; `UNKNOWN_TEAMS.details.teamIds` lists exactly the offending ids; no row written on any error (asserted).

## T-003-08 — Add `ListTasks` with `teamId` / `status` filters and pagination

- **Goal:** the brief's listing, part 1.
- **Changes:** `queries/list-tasks/*`; read model `list` + `count`; `dto/list-tasks.query.dto.ts` (pagination, `teamId`, comma/repeated `status` transform); shared `PageMetaDto`; integration + e2e specs.
- **Covers:** @AC-03.2.1 – @AC-03.2.4, @AC-03.3.1 – @AC-03.3.3, @AC-03.4.1 – @AC-03.4.3, @AC-03.7.1 – @AC-03.7.4, @AC-03.12.2, @AC-03.12.4.
- **Done when:** all filter/pagination outline rows pass; foreign/unknown/deleted `teamId` → empty page without querying tasks; query-count test ≤ 4 for a 100-item page with 3 teams each.

## T-003-09 — Add search and sorting to `ListTasks` + query-plan check

- **Goal:** the brief's listing, part 2.
- **Changes:** read model: escaped `ILIKE` on title/description, ORDER BY whitelist map with `NULLS LAST`, `lower(title)`, id tie-break; DTO `search`, `sort` (`@IsIn(TASK_SORTS)`); integration specs; `apps/api/test/perf/explain-tasks.sql` + EXPLAIN output pasted in the PR.
- **Covers:** @AC-03.4.4, @AC-03.5.1 – @AC-03.5.4, @AC-03.6.1 – @AC-03.6.5, @AC-03.7.5.
- **Done when:** sort outline (10 rows), nulls-last both directions, tie-break and page-walk scenarios pass against PostgreSQL; `100%` and `snake_case` match literally; EXPLAIN on a 10k-task owner meets the plan's table (no Seq Scan on `tasks`).

## T-003-10 — Add `UpdateTask` command and `PUT /tasks/:id`

- **Goal:** edit and reassign teams.
- **Changes:** `commands/update-task/*`; `dto/replace-task.dto.ts`; controller PUT; specs.
- **Covers:** @AC-03.9.1 – @AC-03.9.6, @AC-03.12.1 (edit), @AC-03.12.3 (edit).
- **Done when:** replace/clear/reassign/no-op scenarios pass; status via PUT sets/clears `completedAt`; missing `title`/`status`/`teamIds` → 400; lost race without If-Match retried once (test with a forced conflict).

## T-003-11 — Add `ChangeTaskStatus` command and `PATCH /tasks/:id/status`

- **Goal:** one-tap status change.
- **Changes:** `commands/change-task-status/*`; `dto/change-task-status.dto.ts`; controller PATCH; specs.
- **Covers:** @AC-03.10.1 – @AC-03.10.6, @AC-03.12.1 (status), @AC-03.14.3.
- **Done when:** all 9 matrix rows pass at e2e level (status, version, `completedAt`, `updatedAt`); no-op performs no write (handler spec asserts `save` not called); extra body field → 400.

## T-003-12 — Add `DeleteTask` command and `DELETE /tasks/:id`

- **Goal:** archive tasks.
- **Changes:** `commands/delete-task/*`; controller DELETE (`204`); specs.
- **Covers:** @AC-03.11.1, @AC-03.11.2, @AC-03.12.1 (delete).
- **Done when:** after delete, GET/PUT/PATCH/DELETE → 404 and the task is absent from list under every filter; `deleted_at` set, `task_teams` rows kept (history) but ignored by reads.

## T-003-13 — React to `TeamDeleted`

- **Goal:** tasks survive team deletion.
- **Changes:** `application/events/team-deleted.handler.ts`; repository `findByTeam`/`saveAll`; integration + e2e (through `DELETE /api/v1/teams/:id`).
- **Covers:** @AC-03.13.1 – @AC-03.13.4, @AC-03.2.5 (deleted teams not embedded).
- **Done when:** affected tasks lose only that team and gain +1 version; unaffected tasks untouched; replaying the event is a no-op; works both inside 002's transaction and standalone; failure increments `task_team_unassign_failures_total` and logs `task.team_unassign_failed`.

## T-003-14 — Expose `CountTasksPerTeam` query

- **Goal:** let 002 compute `taskCount` without touching task tables.
- **Changes:** `queries/count-tasks-per-team/*`; read model `countByTeams` (live tasks only); integration spec.
- **Covers:** @AC-03.11.3.
- **Done when:** counts exclude deleted tasks and other owners; one query for N teams; 002's team list uses it via `QueryBus` (verified in 002's e2e).

## T-003-15 — Seed 10 demo tasks

- **Goal:** the brief's seed (10 tasks) for the demo user.
- **Changes:** `apps/api/prisma/seed/tasks.seed.ts` (called by `seed.ts`), fixed UUIDs, dates relative to the seed day; seed test.
- **Covers:** brief seed requirement (EP-07 / 007).
- **Done when:** running the seed twice yields exactly 10 tasks for `demo@teams-tasks.dev` with the plan's distribution (4 PENDING / 3 IN_PROGRESS / 3 DONE, two multi-team, one without team, one overdue, Done tasks with `completedAt`); `docker compose up` shows them via `GET /tasks`.

## T-003-16 — Emit task metrics and span attributes

- **Goal:** operability per the plan's observability table.
- **Changes:** `application/events/task-metrics.handler.ts`; span attribute helpers in handlers; specs with in-memory meter/exporter.
- **Covers:** non-functional (EP-06).
- **Done when:** creating, completing, reopening and deleting tasks increments the expected counters; list spans carry the query attributes; a test asserts no span attribute contains title/description/search text; API works with no collector configured.

## T-003-17 — Add ETag / If-Match optimistic concurrency (COULD)

- **Goal:** reject stale writes.
- **Changes:** `ETag: W/"<version>"` on GET/POST/PUT/PATCH; shared `IfMatch` decorator → `expectedVersion` on update/status/delete commands; 412 mapping with `details.currentVersion`; e2e specs.
- **Covers:** @AC-03.15.1 – @AC-03.15.4.
- **Done when:** conditional-writes outline (8 rows) passes; malformed tag → 412; no-op with stale tag → 412; requests without `If-Match` behave as before (all earlier e2e green).

## T-003-18 — Add Idempotency-Key on `POST /tasks` (COULD)

- **Goal:** retries never duplicate tasks.
- **Changes:** apply the shared `@Idempotent()` interceptor (ADR-0019) to `POST /tasks`; e2e specs with fixed clock.
- **Covers:** @AC-03.16.1 – @AC-03.16.5.
- **Done when:** replay returns the identical status, body and `Location`; different body → 422 `IDEMPOTENCY_KEY_REUSED`; keys scoped per owner; expired key (25 h) creates a new task; malformed key → 400.
