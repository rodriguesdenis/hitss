# 002 — Tasks

Prerequisite: the 001 API foundation and auth tasks T-001-01…T-001-09 (auth config, Prisma, HTTP conventions, security baseline, identity schema, auth and CSRF guards, `CurrentOwner`, two-user helper). Paths follow [overview §6.2](../../architecture/overview.md#62-api-appsapi). Cross-context collaboration uses only the `QueryBus`, the in-transaction event publisher and each module's `contracts/` folder ([ADR-0002](../../architecture/adr/0002-nestjs-clean-architecture-ddd-cqrs.md)). The order below lets each PR ship a working, tested increment.

| ID       | Task                                                                                              | Depends on         | Size | Branch                      |
| -------- | ------------------------------------------------------------------------------------------------- | ------------------ | ---- | --------------------------- |
| T-002-01 | Prisma `Team` model and migration with partial indexes                                            | T-001-05           | S    | `feat/002-team-schema`      |
| T-002-02 | Domain: `TeamName`, `ColorHex`, `TeamDescription`, `Team` aggregate, `TeamDeleted`, errors        | —                  | M    | `feat/002-team-domain`      |
| T-002-03 | `TeamRepository` port + Prisma adapter + mapper, with integration tests                           | T-002-01, T-002-02 | M    | `feat/002-team-repository`  |
| T-002-04 | `CreateTeam` command + `POST /teams` + DTOs + read-back `GetTeam` view                            | T-002-03, T-001-09 | M    | `feat/002-create-team`      |
| T-002-05 | Idempotency keys (shared): table, store, interceptor on `POST /teams`                             | T-002-04           | M    | `feat/002-idempotency-keys` |
| T-002-06 | `ListTeams` query: pagination meta, search, sort (shared pagination)                              | T-002-04           | M    | `feat/002-list-teams`       |
| T-002-07 | `GetTeam` endpoint + ETag (shared `EtagInterceptor`, `@IfMatch`)                                  | T-002-04           | S    | `feat/002-get-team`         |
| T-002-08 | `ReplaceTeam` command + `PUT /teams/:id` with `If-Match` → 412                                    | T-002-07           | M    | `feat/002-replace-team`     |
| T-002-09 | Unit of work + two-phase domain-event publisher (shared); `DeleteTeam` + `DELETE /teams/:id`      | T-002-08           | M    | `feat/002-delete-team`      |
| T-002-10 | Cross-context seams: `contracts/` (`GetTeamSummariesQuery`, `TeamDeleted`), `TeamTaskCounts` port | T-002-06, T-002-09 | S    | `feat/002-team-contracts`   |
| T-002-11 | Seed 3 teams for the demo user                                                                    | T-002-01, T-001-11 | S    | `feat/002-seed-teams`       |
| T-002-12 | Teams telemetry (span attributes, logs; no team domain counters)                                  | T-002-09           | S    | `feat/002-teams-telemetry`  |
| T-002-13 | Teams requests in Bruno/.http, OpenAPI review, contract-doc clarifications                        | T-002-09           | S    | `docs/002-teams-requests`   |

---

## T-002-01 — Prisma `Team` model and migration

- **Goal:** The `teams` table exists with integrity and performance guarantees.
- **Changes:** `apps/api/prisma/schema.prisma` (`Team` model, relation on `User`). Migration `create_teams` with raw SQL appended: partial unique `teams_owner_id_lower_name_key`, partial `teams_owner_id_created_at_idx`, and checks `teams_color_hex_format` and `teams_version_positive`. Verify `docs/architecture/data-model.md` is in sync.
- **Covers:** storage for all US-02.x. Its integrity guarantees back AC-02.1.5, AC-02.1.7 and AC-02.1.9.
- **Done when:** The migration SQL is reviewed. Integration test: two active rows with names that differ only in case for the same owner → `23505`; the same with one row soft-deleted → allowed; a lower-case `color_hex` → check violation. `EXPLAIN` of the default list query uses `teams_owner_id_created_at_idx`.

## T-002-02 — Team domain

- **Goal:** Framework-free domain where invalid teams cannot be constructed.
- **Changes:** `modules/teams/domain/**`, `shared/domain/{aggregate-root.ts,domain-error.ts,domain-event.ts}`, `shared/application/expected-version.ts`, plus unit tests alongside each file.
- **Covers:** `@AC-02.1.2 @AC-02.1.3 @AC-02.1.4 @AC-02.1.10 @AC-02.6.7 @AC-02.9.2 @AC-02.9.6` (domain level)
- **Done when:** Unit tests cover every row of the name, color and description outlines in `teams.feature`, plus accents, Greek case-folding, emoji length (code points), control characters (`\n`, NUL → `InvalidTeamName`) and `contrastingTextColor`. `replace` with equal values returns `false`. `delete` raises exactly one `TeamDeleted`. Line coverage ≥ 90 %. Stryker mutation score ≥ 80 % for `modules/teams/domain`. `depcruise` confirms there are no framework imports.

## T-002-03 — Team repository

- **Goal:** Persist and load the aggregate, scoped by owner, with an optimistic version guard.
- **Changes:** `application/ports/team.repository.ts` (`findById(ownerId, id)`, `existsActiveByName(ownerId, name, excludingId?)`, `insert(team)`, `update(team, expectedVersion)`), `infrastructure/prisma-team.repository.ts`, `team.persistence-mapper.ts`, `test/support/in-memory-team.repository.ts` (fake shared by handler tests), and a contract test suite run against **both** the fake and the Prisma adapter.
- **Covers:** `@AC-02.1.9 @AC-02.9.5` (persistence level), BR-02.8.
- **Done when:** The integration suite (Testcontainers) passes for both owners: foreign and deleted rows are never returned, a unique violation maps to `TeamNameAlreadyExists`, a version mismatch maps to `ConcurrencyConflict { currentVersion }`, a missing row maps to `TeamNotFound`, and two concurrent `update`s at the same version produce exactly one success. The contract suite is green for the in-memory fake.

## T-002-04 — Create team

- **Goal:** `POST /api/v1/teams` creates a team and returns it in the envelope.
- **Changes:** `CreateTeamCommand` and handler. `TeamReadModel.findById` and a `GetTeamHandler` used for the read-back (`TeamTaskCounts` port with the zero-count placeholder adapter, formalized in T-002-10). `CreateTeamDto` (incl. `\p{Cc}` rejection on `name`), `TeamResponseDto`, `team.presenter.ts`, `team-error.mapping.ts`, `TeamsController.create` (`201`, `Location`), `TeamsModule`. Shared `ApiOkEnvelope` swagger helper.
- **Covers:** `@AC-02.1.1 @AC-02.1.2 @AC-02.1.3 @AC-02.1.4 @AC-02.1.5 @AC-02.1.6 @AC-02.1.7 @AC-02.1.8 @AC-02.1.9 @AC-02.1.10 @AC-02.8.3 @AC-02.11.2 @AC-02.11.3 @AC-02.11.4`, `@AC-01.5.1` (create row), `@AC-01.6.4 @AC-01.6.6` (team create rows)
- **Done when:** Handler unit tests: conflict, same name for another owner, name reuse after delete. E2E: the happy path with envelope, `Location` and the trimmed and upper-cased output; one HTTP row per validation rule, including a name with a control character → 400 naming `name`; extra fields → 400 naming the field for every mass-assignment row (`id`, `ownerId`, `owner_id`, `userId`, `owner` as an object, `version`, `taskCount`, `updatedAt`, `deletedAt`, `__proto__`, `constructor`) and the created team's owner is the signed-in user; Marina and Rafael can both create "Mobile" and neither sees the other's; 409 for each case variant; a concurrent pair (`Promise.all`) → one 201 and one 409; anonymous → 401. OpenAPI shows the operation with its request and response schemas.

## T-002-05 — Idempotency keys (shared)

- **Goal:** Retrying `POST /teams` with the same `Idempotency-Key` never duplicates, as decided in [ADR-0019](../../architecture/adr/0019-idempotency-keys.md). The mechanism is reusable by `POST /tasks`.
- **Changes:** Migration `create_idempotency_keys`. `shared/presentation/interceptors/idempotency.interceptor.ts`, `shared/application` `IdempotencyStore` port, `shared/infrastructure/idempotency/{prisma-idempotency.store.ts,request-hash.ts}`. Non-blocking owner-scoped `pg_try_advisory_xact_lock(hashtext(owner_id), hashtext(key))` inside `UnitOfWork.run` (introduces `@nestjs-cls/transactional` if T-002-09 has not landed yet; T-002-09 then reuses it). Canonical JSON sorts keys and ignores prototype keys; the hash includes method and route. `@UseInterceptors(IdempotencyInterceptor)` on create (POST only). Replays rebuild `Location` and `ETag` and add `Idempotent-Replayed: true`. Mappings: `IdempotencyRequestInProgress` → `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` + `Retry-After: 1`, `IdempotencyKeyReused` → 422.
- **Covers:** `@AC-02.10.1 @AC-02.10.2 @AC-02.10.3 @AC-02.10.4 @AC-02.10.5 @AC-02.10.6 @AC-02.10.7 @AC-02.10.8 @AC-02.10.9 @AC-02.10.10 @AC-02.10.11`
- **Done when:** Unit: canonical hash (key order irrelevant, values relevant, `__proto__`/`constructor` never part of it); header validation. Integration: two concurrent identical requests → exactly one team; the other response is the `201` replay or `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` with `Retry-After: 1` (never a second team, never a wait); Rafael's in-flight request with the same key does not block Marina's (owner-scoped lock); an expired row (with `expires_at` set in the past) → processed anew; a rolled-back handler leaves no row. E2E: replay with the identical body (same status, body, `Location`, `ETag`, `Idempotent-Replayed: true`), 422 on a different body, the same key reused on a different route (a test-only probe `POST` until `POST /tasks` exists; re-verified in T-003-18) → 422, per-owner scoping, retry after a 400 or 409 succeeds, no key → normal processing.

## T-002-06 — List teams

- **Goal:** `GET /api/v1/teams` with pagination meta, search and sort.
- **Changes:** Shared `PaginationQueryDto`, `PageMeta`, `ApiPageEnvelope`, sort parser and LIKE-escape helper. `ListTeamsQueryDto`, `ListTeamsHandler`, `PrismaTeamReadModel.page` (raw SQL with whitelisted `ORDER BY … , id`, count query in the same `REPEATABLE READ` read transaction). One `TeamTaskCounts.countByTeam` call per page.
- **Covers:** `@AC-02.2.1 @AC-02.2.2 @AC-02.2.3 @AC-02.2.4 @AC-02.2.5 @AC-02.2.6 @AC-02.2.7 @AC-02.2.8 @AC-02.2.9 @AC-02.3.1 @AC-02.3.2 @AC-02.3.3 @AC-02.3.4 @AC-02.3.5 @AC-02.4.1 @AC-02.4.2 @AC-02.4.3 @AC-02.4.4`, `@AC-01.6.1` (teams row)
- **Done when:** Unit: DTO tables for limit, offset, search (trimmed; blank or whitespace-only → 400 `VALIDATION_FAILED` naming `search`; 101 chars → 400) and sort, and `PageMeta`. Integration: paging over 25 rows, ties with equal `created_at` (each team appears exactly once across pages for every sort), `lower(name)` order, the `%` and `_` literal match, an empty page beyond total with the correct total, deleted rows excluded. E2E: default meta, search plus sort plus paging combined, foreign teams never listed, unknown parameter → 400. `EXPLAIN ANALYZE` with 1,000 teams for one owner is under 5 ms (recorded in the PR).

## T-002-07 — Get team + ETag

- **Goal:** `GET /api/v1/teams/:id` returns the team with `ETag`. Shared ETag and `If-Match` support.
- **Changes:** `TeamsController.findOne` (`ParseUUIDPipe` mapped to `VALIDATION_FAILED` with `field: "id"`). Shared `EtagInterceptor` (also applied to create) and `@IfMatch()` decorator with unit tests.
- **Covers:** `@AC-02.5.1 @AC-02.5.2 @AC-02.5.3 @AC-02.5.4 @AC-02.5.5`, `@AC-01.6.2` (team row), `@AC-01.5.5`
- **Done when:** E2E: `ETag: W/"1"` on get and create. Unknown, foreign and deleted ids give byte-identical 404 bodies apart from `traceId`. Malformed ids → 400. Anonymous with an existing id → 401. Unit: `@IfMatch` parses `W/"3"`, `"3"` and `*`, and treats `abc`, `W/"-1"`, `1` and `garbage` as `unmatchable`.

## T-002-08 — Replace team

- **Goal:** `PUT /api/v1/teams/:id` does a full replacement with an optimistic concurrency guard.
- **Changes:** `ReplaceTeamCommand` and handler in `commands/replace-team/` (load → `assertVersion` → `replace` → name check excluding self → `update`), `ReplaceTeamDto`, `TeamsController.replace`, and the 412 mapping with `details.currentVersion`. Check order: validation `400` → `404` → `412` (malformed `If-Match` → 412) → no-op.
- **Covers:** `@AC-02.6.1 @AC-02.6.2 @AC-02.6.3 @AC-02.6.4 @AC-02.6.5 @AC-02.6.6 @AC-02.6.7 @AC-02.9.1 @AC-02.9.2 @AC-02.9.4 @AC-02.9.5 @AC-02.9.6 @AC-02.9.7`, `@AC-01.6.3 @AC-01.6.6` (team update rows)
- **Done when:** Handler unit tests: no-op keeps the version, case-only rename allowed, 404 before 412. E2E: an invalid body with a stale `If-Match` → 400 (validation first); every mass-assignment row from T-002-04 also → 400 on `PUT`; a name with a control character → 400. E2E: version 1 → 2 and `ETag` updated, omitted description cleared, 409 on collision, stale `If-Match` → 412 with `currentVersion`, a concurrent pair with the same `If-Match` → one 200 and one 412, and a foreign team → 404 with Rafael's row unchanged (checked in the DB).

## T-002-09 — Unit of work, event publisher, delete team

- **Goal:** `DELETE /api/v1/teams/:id` archives the team and publishes `TeamDeleted` inside the same transaction.
- **Changes:** `shared/application/{unit-of-work.ts,domain-event-publisher.ts}`, `shared/infrastructure/{cls-unit-of-work.ts,domain-event-publisher.impl.ts}` (`@InTransactionHandler` discovery plus `EventBus.publishAll` after commit), `ClsModule` + `ClsPluginTransactional` setup, `DeleteTeamCommand` and handler (soft delete only; the Teams repository never deletes `task_teams` rows), `TeamsController.remove` (204, `If-Match`). After-commit handlers are for logs only and never affect the response.
- **Covers:** `@AC-02.7.1 @AC-02.7.3 @AC-02.7.4 @AC-02.9.3 @AC-02.9.8 @AC-02.11.1`, `@AC-01.6.3` (team delete row). `@AC-02.7.2` is verified in **T-003-13** with Task Management's `OnTeamDeletedHandler`.
- **Done when:** Integration: a failing fake in-transaction handler rolls back the soft delete (team still active); a succeeding one commits both; after-commit handlers run only after commit. E2E: 204, then get → 404 and the list excludes it; delete again / unknown / foreign → 404; a foreign team with any `If-Match` → 404 identical to an unknown id, Rafael's team unchanged (AC-02.9.8); stale `If-Match` → 412 and the team is still present. Ownership outline (AC-02.11.1): with `twoUsers()`, list, search, get, replace and delete never expose or change Rafael's teams, and by-id operations return byte-identical 404 bodies apart from `traceId`.

## T-002-10 — Cross-context seams

- **Goal:** Give Task Management a stable public contract, and give Team Management a port for task counts, with no provider imported across modules.
- **Changes:** `modules/teams/contracts/{get-team-summaries.query.ts,team-summary.ts,team-deleted.event.ts}` (query, result type, re-exported event; plain TypeScript). `application/queries/get-team-summaries/` handler (`TeamReadModel.summaries(ownerId, ids)`: live teams of that owner only). `application/ports/team-task-counts.ts` (`TeamTaskCounts.countByTeam(ownerId, teamIds)`) and `infrastructure/team-task-counts.adapter.ts` returning zeros as a placeholder, with a `// replaced by CountTasksByTeamQuery in T-003-14` note. `TeamsModule` exports **no** providers. `depcruise` rule: outside `modules/teams/**`, only `modules/teams/contracts/**` may be imported.
- **Covers:** prerequisite for `@AC-01.6.5`, `@AC-02.7.2`, `@AC-02.8.1`, `@AC-02.8.2`. These are verified in 003: AC-02.7.2 in **T-003-13**, AC-02.8.1 and AC-02.8.2 in **T-003-14** (real counts through `CountTasksByTeamQuery`), AC-01.6.5 in T-003-05/07/08.
- **Done when:** Integration: `GetTeamSummariesQuery` through the `QueryBus` returns only active teams of that owner, makes no ordering assumptions, and handles empty and duplicate ids. Unit: the placeholder adapter returns 0 for every id. The `depcruise` rule fails on a fixture that imports `modules/teams/domain` or `teams.module.ts` from another module.

## T-002-11 — Seed teams

- **Goal:** The demo user has 3 teams on every fresh start.
- **Changes:** `prisma/seed/teams.seed.ts` (fixed literal fixtures, no faker; fixed UUIDs, upsert by id with `deleted_at` reset, fixed timestamps, `DEMO_TEAM_IDS` exported for the task seed), wired into the `prisma/seed.ts` orchestrator (T-007-07). Skipped when the demo user is not seeded (`SEED_DEMO=false` or `APP_ENV=production`).
- **Covers:** brief "Seeds/fixtures (3 times)", part of `@AC-01.8.3`.
- **Done when:** Integration: seeding twice gives exactly 3 teams for the demo user with unchanged rows. E2E: the demo user lists Mobile, Backend and Design.

## T-002-12 — Teams telemetry

- **Goal:** Team operations are observable without user content.
- **Changes:** Span attributes per the plan. `team.*` log events (after-commit handlers). No team domain counters: the domain metrics are only `tasks_created_total`, `tasks_completed_total` and `tasks_deleted_total` (003); team traffic shows in the HTTP RED metrics of 006.
- **Covers:** plan [Observability](plan.md#observability).
- **Done when:** Unit tests with an in-memory span exporter: handler spans exist for each command and query; list spans carry `teams.list.*` and never the search term; a log capture contains no team names or descriptions.

## T-002-13 — Requests and contract docs

- **Goal:** Evaluators can exercise teams from Bruno, `.http` or cURL, and the contract doc reflects the clarified behavior.
- **Changes:** `tools/bruno/teams/*.bru` (list with search, sort and paging; create with `Idempotency-Key`; get; update with `If-Match`; delete), `tools/http/teams.http`, and the remaining clarifications proposed to the architect for `docs/architecture/api-contracts.md` (`-field` sorts, literal wildcards; blank search → 400 is already in the contract). ETag on POST/PUT, `Idempotent-Replayed` and `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` are already in the contract.
- **Covers:** brief "exemplos de requisições" (teams).
- **Done when:** `bru run tools/bruno/teams` is green against `docker compose up`. The OpenAPI contract-drift check (007) passes and the regenerated client compiles.
