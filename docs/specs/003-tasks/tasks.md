# 003 — Tasks

Ordered, atomic tasks; **each task = one PR** (Conventional Commits, scope `api`, [ADR-0017](../../architecture/adr/0017-conventional-commits-and-atomic-prs.md)). Every PR: TDD, `pnpm --filter @hitss/api lint typecheck test` green, OpenAPI/client regenerated when the contract changes, scenarios of **Covers** automated, [Definition of Done](../../quality/definition-of-done.md).

Prerequisites from other specs: authenticated `ownerId` decorator and guards (001), `Team` model, `teams/contracts/` (`GetTeamSummariesQuery`, `TeamDeleted`) and the in-transaction event publisher (002, T-002-09/T-002-10), shared envelope/filter/`Clock`/`IdGenerator`/unit of work (001/002). Paths follow [overview §6.2](../../architecture/overview.md#62-api-appsapi). Cross-context calls go only through the `QueryBus`, the in-transaction publisher and `contracts/` folders.

**ACs of 002 verified here:** `AC-02.7.2` (T-003-13), `AC-02.8.1` and `AC-02.8.2` (T-003-14). 002 binds a zero-count placeholder until T-003-14 lands.

| ID       | Task                                                                        | Depends on                 | Size | Branch                           |
| -------- | --------------------------------------------------------------------------- | -------------------------- | ---- | -------------------------------- |
| T-003-01 | Add `tasks`, `task_teams`, `task_status` schema, migration, indexes, CHECKs | T-002-01                   | M    | `feat/003-tasks-schema`          |
| T-003-02 | Implement task value objects (TDD)                                          | —                          | S    | `feat/003-task-value-objects`    |
| T-003-03 | Implement `Task` aggregate, events, errors, overdue policy (TDD)            | 02                         | M    | `feat/003-task-aggregate`        |
| T-003-04 | Add `TaskRepository` port + Prisma adapter                                  | 01, 03                     | M    | `feat/003-task-repository`       |
| T-003-05 | Add `TeamDirectory` port + `QueryBus` adapter (`GetTeamSummariesQuery`)     | T-002-10                   | S    | `feat/003-team-directory`        |
| T-003-06 | Add read model, view assembler and `GET /tasks/:id`                         | 04, 05                     | M    | `feat/003-get-task`              |
| T-003-07 | Add `CreateTask` command and `POST /tasks`                                  | 06                         | M    | `feat/003-create-task`           |
| T-003-08 | Add `ListTasks` with `teamId` / `status` filters and pagination             | 06                         | M    | `feat/003-list-filters`          |
| T-003-09 | Add search and sorting to `ListTasks` + query-plan check                    | 08                         | M    | `feat/003-list-search-sort`      |
| T-003-10 | Add `ReplaceTask` command and `PUT /tasks/:id`                              | 07                         | M    | `feat/003-replace-task`          |
| T-003-11 | Add `ChangeTaskStatus` command and `PATCH /tasks/:id/status`                | 06                         | S    | `feat/003-change-status`         |
| T-003-12 | Add `DeleteTask` command and `DELETE /tasks/:id`                            | 06                         | S    | `feat/003-delete-task`           |
| T-003-13 | `OnTeamDeletedHandler` in-transaction (unassign team, bump versions)        | 04, 06, T-002-09, T-002-10 | S    | `feat/003-team-deleted-reaction` |
| T-003-14 | Expose `CountTasksByTeamQuery`; switch 002's `TeamTaskCounts` adapter to it | 06, T-002-10               | S    | `feat/003-count-tasks-by-team`   |
| T-003-15 | Seed 10 demo tasks                                                          | 01, T-002-11               | S    | `feat/003-seed-tasks`            |
| T-003-16 | Emit task metrics and span attributes                                       | 07, 11, 12                 | S    | `feat/003-task-observability`    |
| T-003-17 | Add ETag / If-Match optimistic concurrency (COULD)                          | 10, 11, 12                 | M    | `feat/003-task-if-match`         |
| T-003-18 | Add Idempotency-Key on `POST /tasks` (COULD)                                | 07, T-002-05               | S    | `feat/003-idempotent-create`     |

MUST work (01–15) is complete and demo-able before any COULD task (17–18) starts (constitution IX.1). 16 is cross-cutting and can run in parallel after 12.

---

## T-003-01 — Add `tasks`, `task_teams`, `task_status` schema, migration, indexes, CHECKs

- **Goal:** persistence for Task Management exactly as [data-model.md](../../architecture/data-model.md) + the plan's proposed `tasks_owner_created_idx`.
- **Changes:** `apps/api/prisma/schema.prisma` (`TaskStatus`, `Task`, `TaskTeam`, back-relations on `User`/`Team`); `prisma/migrations/<ts>_create_tasks/migration.sql` (generated + raw SQL: `pg_trgm`, partial indexes, GIN, CHECKs); `docs/architecture/data-model.md` only if the proposed index is approved (the database-specialist / architect owns that file).
- **Covers:** foundation (no scenario); CHECK constraints back BR-03.1, BR-03.5.
- **Done when:** `prisma migrate deploy` on an empty DB succeeds; `\d tasks` shows all indexes and CHECKs; a follow-up `prisma migrate dev --create-only` produces an empty migration (no drift); integration smoke inserting a row violating each CHECK fails.

## T-003-02 — Implement task value objects (TDD)

- **Goal:** invalid task values cannot be constructed.
- **Changes:** `modules/tasks/domain/value-objects/{task-title,task-description,task-status,due-date,task-team-ids}.ts` + `*.spec.ts`; errors `InvalidTaskTitle`, `InvalidTaskDescription`, `InvalidTaskStatus`, `InvalidDueDate`, `TooManyTeams`.
- **Covers:** @AC-03.1.2 @AC-03.1.3 @AC-03.1.5 @AC-03.1.6 (count) @AC-03.1.8 — outline rows at unit level.
- **Done when:** title 0/2/3/120/121 code points (after trim), title with `\n` / NUL / `\u007F` rejected, description 2000/2001 and control characters other than line breaks rejected, all due-date rows, team ids 0/1/10/11 and order-insensitive equality tested; 100 % branch coverage on VOs; no framework imports (dependency-cruiser).

## T-003-03 — Implement `Task` aggregate, events, errors, overdue policy (TDD)

- **Goal:** lifecycle rules live in the aggregate.
- **Changes:** `domain/task.ts`, `domain/overdue.policy.ts`, `domain/task.events.ts`, `domain/task.errors.ts` (`TaskNotFound`, `UnknownTeams`) + specs (`ConcurrencyConflict` is reused from `shared/domain`).
- **Covers:** @AC-03.1.1 @AC-03.1.4 @AC-03.9.4 @AC-03.9.5 @AC-03.10.1 @AC-03.10.2 @AC-03.10.3 @AC-03.10.5 @AC-03.13.2 @AC-03.13.4 @AC-03.14.1 @AC-03.14.2 @AC-03.14.3 (unit level).
- **Done when:** the 9-row transition matrix passes (status, `changed` — which is what makes persistence write version + 1 —, `completedAt`, `updatedAt`, event emitted or not; the aggregate's `version` itself never changes); edit no-op returns `false` and leaves `updatedAt`; `unassignTeam` reports a change (and touches `updatedAt`) only when the team was assigned; overdue table passes with fixed today; Stryker ≥ 80 % on `domain/`.

## T-003-04 — Add `TaskRepository` port + Prisma adapter

- **Goal:** persist the aggregate atomically with its team links and optimistic version check.
- **Changes:** `domain/task.repository.ts`; `infrastructure/prisma-task.repository.ts`, `infrastructure/task.mapper.ts`; integration specs (Testcontainers).
- **Covers:** @AC-03.9.2 (team set replace), @AC-03.11.1 (soft delete invisible to `findById`), @AC-03.12.1 (owner scoping), @AC-03.15.3 (race: two saves of v3 → exactly one wins).
- **Done when:** `save` inserts/updates `tasks` and diff-syncs `task_teams` in one transaction (`TransactionHost`); update uses `WHERE id, owner_id, version, deleted_at IS NULL` and throws `ConcurrencyConflict` on 0 rows; `findById` / `findByTeam` never return another owner's or deleted rows; round-trip mapping test for every field.

## T-003-05 — Add `TeamDirectory` port + adapter to Teams

- **Goal:** Task Management learns about teams only through a port.
- **Changes:** `application/ports/team-directory.ts` (`findMissing`, `summaries`); `infrastructure/adapters/team-directory.adapter.ts` sending `GetTeamSummariesQuery` (from `teams/contracts/`) on the `QueryBus`; `tasks.module.ts` imports **no** Teams module or provider; in-memory fake for handler tests.
- **Covers:** prerequisite for @AC-03.1.6 @AC-03.2.5 @AC-03.12.3, `@AC-01.6.5`.
- **Done when:** integration test through the real `QueryBus`: live own team → found; deleted, foreign and unknown ids → reported missing and excluded from `summaries`; dependency-cruiser forbids `tasks/**` importing anything in `modules/teams/**` except `contracts/**`.

## T-003-06 — Add read model, view assembler and `GET /tasks/:id`

- **Goal:** first endpoint; the `TaskView` used by every response.
- **Changes:** `application/ports/task.read-model.ts`; `infrastructure/prisma-task.read-model.ts` (`findById`); `application/views/*`; `queries/get-task/*`; `presentation/tasks.controller.ts` (GET), `dto/task.response.dto.ts`, `dto/team-chip.dto.ts`, `task-error.mapper.ts`; e2e spec.
- **Covers:** @AC-03.8.1 @AC-03.8.2 @AC-03.8.3 @AC-03.2.5 (team order) @AC-03.12.1 (view) @AC-03.12.5 (view) @AC-03.14.1 @AC-03.14.2.
- **Done when:** e2e returns the contract shape (teams by name, `isOverdue` with fixed clock); unknown/deleted/foreign → 404 `TASK_NOT_FOUND`; `abc` → 400 field `id`; no session → 401; OpenAPI shows the response schema.

## T-003-07 — Add `CreateTask` command and `POST /tasks`

- **Goal:** capture tasks with validation and team assignment.
- **Changes:** `commands/create-task/*`; `dto/create-task.dto.ts` (+ `IsCalendarDate` validator, `\p{Cc}` rules, `@ArrayMaxSize(100)` on `teamIds`); controller POST (`201`, `Location`, `ETag`); e2e + handler specs.
- **Covers:** @AC-03.1.1 – @AC-03.1.8, @AC-03.12.3 (create), @AC-03.12.5 (create), @AC-03.12.6, `@AC-01.6.4 @AC-01.6.6 @AC-01.6.5` (task create rows).
- **Done when:** every create outline row of `tasks.feature` passes at e2e level; mass-assignment rows (`id`, `ownerId`, `owner_id`, `userId`, `owner` as an object, `version`, `completedAt`, `createdAt`, `updatedAt`, `deletedAt`, `teams`, `isOverdue`, `__proto__`, `constructor`) → 400 naming the field and the owner is always the signed-in user; control characters in title/description → 400; 101 `teamIds` → 400, 11 → `422 TOO_MANY_TEAMS`; `TOO_MANY_TEAMS` precedes `UNKNOWN_TEAMS`; `UNKNOWN_TEAMS.details.teamIds` lists exactly the offending ids; a foreign team id and a never-existing id give byte-identical `422 UNKNOWN_TEAMS` bodies apart from `traceId` and ids; no row written on any error (asserted).

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

## T-003-10 — Add `ReplaceTask` command and `PUT /tasks/:id`

- **Goal:** edit and reassign teams.
- **Changes:** `commands/replace-task/*`; `dto/replace-task.dto.ts`; controller PUT; specs.
- **Covers:** @AC-03.9.1 – @AC-03.9.6, @AC-03.12.1 (edit), @AC-03.12.3 (edit), @AC-03.12.6 (edit), `@AC-01.6.6` (task update rows).
- **Done when:** replace/clear/reassign/no-op scenarios pass; every mass-assignment row of T-003-07 also → 400 on `PUT`; status via PUT sets/clears `completedAt`; missing `title`/`status`/`teamIds` → 400; lost race without If-Match retried once (test with a forced conflict).

## T-003-11 — Add `ChangeTaskStatus` command and `PATCH /tasks/:id/status`

- **Goal:** one-tap status change.
- **Changes:** `commands/change-task-status/*`; `dto/change-task-status.dto.ts`; controller PATCH; specs.
- **Covers:** @AC-03.10.1 – @AC-03.10.6, @AC-03.12.1 (status), @AC-03.14.3.
- **Done when:** all 9 matrix rows pass at e2e level (status, version, `completedAt`, `updatedAt`); no-op performs no write (handler spec asserts `save` not called); extra body fields → 400 (`version`, `completedAt`, `createdAt`, `updatedAt`, `deletedAt`, `teams`, `isOverdue`, `__proto__`, `constructor`).

## T-003-12 — Add `DeleteTask` command and `DELETE /tasks/:id`

- **Goal:** archive tasks.
- **Changes:** `commands/delete-task/*`; controller DELETE (`204`); specs.
- **Covers:** @AC-03.11.1, @AC-03.11.2, @AC-03.12.1 (delete).
- **Done when:** after delete, GET/PUT/PATCH/DELETE → 404 and the task is absent from list under every filter; `deleted_at` set, `task_teams` rows kept (history) but ignored by reads.

## T-003-13 — `OnTeamDeletedHandler` (in-transaction)

- **Goal:** tasks survive team deletion, atomically with it.
- **Changes:** `application/events/on-team-deleted.handler.ts` registered with 002's `@InTransactionHandler(TeamDeleted)` (`TeamDeleted` imported from `teams/contracts/`; **not** an `@EventsHandler`); repository `findByTeam`/`saveAll` (removes the team's `task_teams` rows, bumps each affected task's `version` and `updatedAt`); integration + e2e (through `DELETE /api/v1/teams/:id`).
- **Covers:** @AC-03.13.1 – @AC-03.13.4, @AC-03.2.5 (deleted teams not embedded), and **`@AC-02.7.2`** from 002.
- **Done when:** affected tasks lose only that team (other assignments untouched) and gain +1 version and a new `updatedAt`; unaffected tasks untouched; replaying the event is a no-op; the handler joins 002's transaction, and a forced failure in it rolls back the team's soft delete (team still active, `task_teams` intact); e2e: a stale `PUT /tasks/:id` with the pre-delete `If-Match` → 412. There is no after-commit fallback or retry.

## T-003-14 — Expose `CountTasksByTeamQuery`

- **Goal:** let 002 compute `taskCount` without touching task tables.
- **Changes:** `modules/tasks/contracts/count-tasks-by-team.query.ts` (+ result type); `queries/count-tasks-by-team/*`; read model `countByTeams` (live tasks only); 002's `team-task-counts.adapter.ts` switched from the zero placeholder to sending the query on the `QueryBus` (placeholder deleted); integration + e2e specs.
- **Covers:** @AC-03.11.3, and **`@AC-02.8.1 @AC-02.8.2`** from 002 (real task counts).
- **Done when:** counts exclude deleted tasks and other owners; one query for N teams; e2e: `GET /teams` and `GET /teams/:id` show `taskCount` equal to the owner's active tasks per team (AC-02.8.1); deleting or unassigning a task decreases it by one (AC-02.8.2).

## T-003-15 — Seed 10 demo tasks

- **Goal:** the brief's seed (10 tasks) for the demo user.
- **Changes:** `apps/api/prisma/seed/tasks.seed.ts` (called by the `prisma/seed.ts` orchestrator of T-007-07): fixed literal fixtures (no faker), fixed UUIDs upserted by id, due dates relative to the seed day; skipped with the demo user (`SEED_DEMO=false` or `APP_ENV=production`); seed test.
- **Covers:** brief seed requirement (EP-07 / 007), completes `@AC-01.8.3` with T-002-11.
- **Done when:** running the seed twice yields exactly 10 tasks for `demo@teams-tasks.dev` with the plan's distribution (4 PENDING / 3 IN_PROGRESS / 3 DONE, two multi-team, one without team, one overdue, Done tasks with `completedAt`); `docker compose up` shows them via `GET /tasks`.

## T-003-16 — Emit task metrics and span attributes

- **Goal:** operability per the plan's observability table.
- **Changes:** `application/events/task-metrics.handler.ts`; span attribute helpers in handlers; specs with in-memory meter/exporter.
- **Covers:** non-functional (EP-06).
- **Done when:** creating (incl. created as `DONE`), completing, reopening and deleting tasks increments exactly `tasks_created_total`, `tasks_completed_total` and `tasks_deleted_total` as expected (no other domain counters); list spans carry the query attributes; a test asserts no span attribute contains title/description/search text; API works with no collector configured.

## T-003-17 — Add ETag / If-Match optimistic concurrency (COULD)

- **Goal:** reject stale writes.
- **Changes:** `ETag: W/"<version>"` on GET/POST/PUT/PATCH; shared `IfMatch` decorator → `expectedVersion` on update/status/delete commands; 412 mapping with `details.currentVersion`; e2e specs.
- **Covers:** @AC-03.15.1 – @AC-03.15.5.
- **Done when:** conditional-writes outline (8 rows) passes; check order validation 400 → 404 → 412 → no-op (an invalid body with a stale tag → 400; a foreign, unknown or deleted task with any tag → 404); malformed tag → 412; no-op with stale tag → 412; requests without `If-Match` behave as before (all earlier e2e green).

## T-003-18 — Add Idempotency-Key on `POST /tasks` (COULD)

- **Goal:** retries never duplicate tasks.
- **Changes:** apply the shared `IdempotencyInterceptor` (ADR-0019, T-002-05) to `POST /tasks`; e2e specs with fixed clock.
- **Covers:** @AC-03.16.1 – @AC-03.16.8.
- **Done when:** replay returns the identical status, body, `Location` and `ETag` with `Idempotent-Replayed: true`; two concurrent identical requests → exactly one task, the other gets the `201` replay or `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` with `Retry-After: 1`; another owner's in-flight request with the same key never blocks mine; a key first used on `POST /teams` → `422 IDEMPOTENCY_KEY_REUSED` on `POST /tasks` and nothing is created; different body → 422 `IDEMPOTENCY_KEY_REUSED`; keys scoped per owner; expired key (25 h) creates a new task; malformed key → 400.
