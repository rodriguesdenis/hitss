# 008 — Tasks

Each task is one PR. The brief's e2e contract stays green on every PR. Order: T-008-01, then T-008-08 first (so removals do not trip the traceability gate), T-008-02 and T-008-03 in parallel, T-008-04 → 05 → 06 → 07 in sequence, T-008-09 last. Addendum (user-approved 2026-10-22): T-008-10a → 10b → 11 → 12, one PR each, in that order.

| ID        | Task                                                                                       | Owner                                            | Depends on | Branch                            |
| --------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------ | ---------- | --------------------------------- |
| T-008-01  | ADR-0020 and spec / plan / tasks                                                           | software-architect                               | —          | `docs/008-simplification`         |
| T-008-02  | Bearer-only auth on `/api/v1`                                                              | nestjs-specialist                                | 01, 08     | `refactor/008-bearer-only`        |
| T-008-03  | Slim observability                                                                         | observability-sre                                | 01, 08     | `refactor/008-slim-observability` |
| T-008-04  | Remove ETag / `If-Match` / `412`                                                           | nestjs-specialist                                | 01, 08     | `refactor/008-no-etag`            |
| T-008-05  | Teams module to the new layout with use cases                                              | nestjs-specialist                                | 04         | `refactor/008-teams-layout`       |
| T-008-06  | Tasks module to the new layout, `TeamLookup`, single-transaction delete, drop `nestjs-cls` | database-specialist                              | 05         | `refactor/008-tasks-layout`       |
| T-008-07  | Remove `@nestjs/cqrs` and shared leftovers; dependency-cruiser rules for the new paths     | database-specialist or devops-ci                 | 06         | `refactor/008-no-cqrs`            |
| T-008-08  | CI gate without the doc / traceability checks                                              | devops-ci                                        | 01         | `ci/008-gate`                     |
| T-008-09  | Docs reduction                                                                             | software-architect + observability-sre           | 02–08      | `docs/008-reduction`              |
| T-008-10a | Fewer files: shared pieces and the teams side                                              | nestjs-specialist (Forge)                        | 09         | `refactor/008-fewer-files-teams`  |
| T-008-10b | Fewer files: the tasks side                                                                | database-specialist (Strata)                     | 10a        | `refactor/008-fewer-files-tasks`  |
| T-008-11  | Tests inside each module                                                                   | observability-sre (Lantern) + devops-ci (Gantry) | 10b        | `refactor/008-tests-per-module`   |
| T-008-12  | Remove explanatory code comments                                                           | observability-sre (Lantern)                      | 11         | `refactor/008-no-comments`        |

## T-008-01 — ADR and spec

- **Goal:** the decision and its plan are written and approved before code changes.
- **Changes:** `docs/architecture/adr/0020-…md` (new), superseded notes in ADR-0002, 0007, 0013, 0015 and the ADR index; `docs/specs/008-simplification/{spec,plan,tasks}.md`; specs index row.
- **Done when:** ADR-0020 is Accepted and linked from the superseded ADRs; the spec lists the contract changes and acceptance criteria; the plan gives the target tree, removals per task and the PR order.

## T-008-02 — Bearer-only auth

- **Goal:** `/api/v1/*` authenticates with Bearer tokens only (AC-08.2).
- **Changes:** auth guard rejects a cookie-only request on `/api/v1` (`401`); remove `CsrfGuard`, Origin/`Sec-Fetch-Site` checks, `JsonBodyGuard` and the `415` code; remove the cookie security scheme from OpenAPI; delete their specs and e2e cases; mark the affected 001 ACs "Superseded by 008"; update api-contracts (auth row, error table).
- **Status:** done
- **Done when:** e2e: cookie-only → `401`, Bearer → as before; no CSRF/`415` code left; contract suites green.

## T-008-03 — Slim observability

- **Status:** done
- **Goal:** pino JSON logs + optional OTLP auto-instrumentation only (AC-08.7).
- **Changes:** `instrumentation.ts` starts the NodeSDK with auto-instrumentations only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (and `OTEL_SDK_DISABLED` is not `true`); remove the sanitizing exporter, metric views, `@Traced` + its guard spec, diag logger, telemetry lifecycle/shutdown, the task metrics port/adapter/handlers and unused OTel packages; keep logger config, request id, redaction, trace id in logs; compose smoke checks "no export without the endpoint".
- **Done when:** unit/e2e green; logs carry `reqId` and `traceId`; with the endpoint set, the smoke sink receives a trace.

## T-008-04 — Remove ETag / `If-Match`

- **Goal:** last-write-wins updates (AC-08.3).
- **Changes:** remove `EtagInterceptor`, `@IfMatch`, `ExpectedVersion`, `assertVersion`, the `ConcurrencyConflict` → `412` mapping and the retry-once loops; repositories update by `id` + `owner_id` and still increment `version`; delete the precondition e2e cases; mark the affected 002/003 ACs "Superseded by 008"; update api-contracts.
- **Status:** done
- **Done when:** e2e: `If-Match` ignored, no `ETag`, no `412`; contract suites green.

## T-008-05 — Teams module, new layout

- **Goal:** teams follows ADR-0020's layout with use cases (no CQRS inside teams).
- **Changes:** `domain/{entities,value-objects,errors,repositories}`, `application/use-cases/*`, `presentation/http/{controller,dto,presenters}`, `infrastructure/persistence/*`; `Team.create()` / `Team.restore()`; `TeamLookup` service exported by `TeamsModule` (summaries, missing ids), and tasks' `TeamDirectory` adapter switched to it (replacing `GetTeamSummariesQuery`); `taskCount` computed in the teams read SQL (replacing `CountTasksByTeamQuery`). The `TeamDeleted` contract and its in-transaction reaction stay until T-008-06.
- **Status:** done
- **Done when:** teams unit/integration/e2e green; tasks reach teams only through `TeamLookup`; `teams/contracts/` holds only `team-deleted.event.ts` (removed in T-008-06); `TeamsModule` imports nothing from tasks.
- **Note:** Clock moved to `shared/domain/clock.ts`. `Team.create()` draws its id with the global `crypto.randomUUID()` (no import, so the domain stays dependency-free), and `IdGenerator` stays for tasks until T-008-06. `DeleteTeamUseCase` keeps the unit of work, the publisher and the in-transaction `TeamDeleted` reaction until T-008-06 (agreed with Strata). dependency-cruiser `contexts-isolated` also allows `<b>-lookup.service.ts` and `<b>s.module.ts`; T-008-07 rewrites the rest. The architecture overview and domain-model docs still describe the QueryBus seams; they belong to T-008-09.

## T-008-06 — Tasks module, new layout, single-transaction delete

- **Status:** done
- **Goal:** tasks follows the layout; `DeleteTeam` is one Prisma transaction (AC-08.4); no `nestjs-cls` (AC-08.5).
- **Changes:** tasks moved like teams; `TeamDirectory` adapter → `TeamLookup`; `DeleteTeam` use case: `prisma.$transaction` soft-deleting the team and deleting its `task_teams` rows; remove the unit of work, two-phase publisher, `@InTransactionHandler`, `OnTeamDeletedHandler`, the advisory lock, `tasks/contracts/` and the `nestjs-cls` packages; integration test for the transaction rollback.
- **Done when:** tasks unit/integration/e2e green, incl. team-delete unassignment; the rollback test passes; no `nestjs-cls` import.
- **Delivered:** tasks mirrors teams (`domain/{entities,errors,policies,repositories,value-objects}`, `application/{ports/task.read-model.ts, use-cases/, views/}`, `presentation/http/`, `infrastructure/persistence/`), with the read port kept like teams (views, not entities). Use cases inject `TeamLookup` directly; the `TeamDirectory` port and adapter are gone. `TeamRepository.delete` runs one `prisma.$transaction`: soft delete (version + 1), **one set-based `UPDATE`** bumping `version` and `updated_at` of the owner's live tasks linked to the team (AC-03.13.4 kept, Maestro decision), then `DELETE FROM task_teams WHERE team_id`. Domain events (`TaskCreated`, `TaskStatusChanged`, `TaskDeleted`, `TeamDeleted`) had no consumer left and are removed with `Task.unassignTeam`, `TaskTeamIds.without` and `findByTeam`. Also removed: `shared/infrastructure/transactions/*`, the `UnitOfWork`, `DomainEventPublisher` and in-transaction handler ports, and the three `nestjs-cls` packages. `IdGenerator` is gone from tasks (`Task.create()` draws `crypto.randomUUID()`). The rollback test fails the last statement with a test-only trigger.

## T-008-07 — Remove `@nestjs/cqrs`, update architecture rules

- **Goal:** no CQRS package or leftover shared abstractions; rules match the new tree (AC-08.5, AC-08.6).
- **Changes:** remove `@nestjs/cqrs` and `CqrsModule`; delete unused `shared/application/*`; rewrite `.dependency-cruiser.cjs` (domain pure; use cases → domain + repositories only; presentation → use cases; persistence → domain; cross-module only through `<b>-lookup.service.ts` / `<b>s.module.ts`) with meta-test fixtures per rule.
- **Status:** done
- **Done when:** `pnpm arch` and its meta-tests green; no `@nestjs/cqrs` in `package.json`.
- **Note:** rules after this task: the three domain rules, `application-not-to-adapters`, `infrastructure-not-to-presentation`, the new `persistence-not-to-use-cases`, `presentation-not-to-infra`, the new `presentation-not-to-repositories`, and `contexts-isolated` with only the lookup-service and module-file exceptions (the `contracts/` exception and both contracts rules are gone). Each rule has a violating fixture in `rules.test.mjs`. Also removed: `IdGenerator` and `UuidGenerator`, and `AggregateRoot` and `DomainEvent`, which had no users left. `precise-unknown-teams.ts` moved to `use-cases/shared/` (Trestle). The architecture docs still describe the old rules; they belong to T-008-09.

## T-008-08 — CI gate

- **Goal:** the gate checks code, not documents (AC-08.8).
- **Changes:** `ci-success` needs lint, typecheck, unit, integration, e2e, build, compose smoke, gitleaks, audit; traceability, README doc-check and production-readiness checks move out (optional local scripts or a non-required job).
- **Done when:** a PR that changes only docs or removes AC-tagged tests passes the gate when the code checks pass.
- **Status:** done
- **Delivered:** `docs-checks` is a separate non-required job (`continue-on-error`) running `traceability:check`, `doc-check` and `test:docs`; the four document-check test files moved to `tools/docs-checks/`, so `test:tools` (in the gate) no longer exercises them; `tools/ci/ci-gate.test.mjs` pins the gate.

## T-008-09 — Docs reduction

- **Status:** done
- **Goal:** the docs describe the code as it is, in few documents (AC-08.9).
- **Changes:** README (how to run, decisions, data model, API summary, tests, production notes); keep about six ADRs current (monorepo, NestJS layering as amended by 0020, PostgreSQL + Prisma, REST + envelope + pagination, Better Auth Bearer, Docker one-command run) and mark the rest superseded or historical; one architecture document replacing overview/domain-model/data-model/api-contracts overlap; specs, features and the traceability matrix marked as optional process material.
- **Done when:** every document left in the main path matches the code; links resolve.
- **Delivered:** README and `docs/README.md` rewritten around the code as it is (process material in its own section); one architecture document, `overview.md`, with the domain model folded in (`domain-model.md` removed, links redirected); ADRs 0001–0007, 0014, 0018 and 0020 kept, the other ten moved to `adr/archive/` with a one-line index; the ADR-0020 and plan trees amended (read-model ports, `domain/policies/`, `application/views/`, `shared/presentation/`); data model, constitution §II.2/§III.2 and test strategy updated; threat model and ADR-0007 from security (S-06, E-06, I-03, I-12, R-12, R-16/R-19 closed, R-20, R-21); operations docs from observability-sre; README Testing line from devops-ci.

## T-008-10a — Fewer files: shared pieces and the teams side

- **Goal:** fewer files per module with the same behaviour (AC-08.10); teams ~18 source files.
- **Changes:** (f) `tasks/presentation/http/validators/is-calendar-date.ts` → `shared/presentation/validators/`; (h) `@ApiExtraModels` registered inside `ApiOkEnvelope` / `ApiCreatedEnvelope` / `ApiPageEnvelope`, removed from the controllers; (d) `TeamLookup` gains the precise unknown-teams check (replaces `tasks/application/use-cases/shared/precise-unknown-teams.ts`; tasks switch to it in this PR or in 10b, agreed with Strata); teams side of (b) `TeamDescription` folded into `Team` validation (keeps `TeamName`, `ColorHex`); teams side of (e) one team DTO base where create and update are equal; teams side of (g) `team.persistence-mapper.ts` → private functions in `team.prisma-repository.ts`. Unit tests of removed files move to the entity / repository / lookup tests; nothing they assert changes.
- **Status:** done
- **Done when:** unit, integration and e2e green; `pnpm arch` green; OpenAPI document unchanged (snapshot or diff); overview §6 tree updated for teams and shared.
- **Note:** (d) is `TeamLookup.assertAllLive(ownerId, ids, toError)`; the caller passes its own error because teams knows nothing of tasks. The tasks use cases switched to it in this PR. (f): the shared validator keeps its own calendar check (shared code may not import a module); `DueDate` still re-checks in the domain. OpenAPI: same content before and after, with only the `components.schemas` order changed. Teams has 22 source files; 10b and 11 shrink both modules further.

## T-008-10b — Fewer files: the tasks side

- **Goal:** the same for tasks (AC-08.10); tasks ~22 source files.
- **Changes:** (a) `domain/policies/overdue.policy.ts` → `Task.isOverdue(today)` (the read side computes the same rule from the view: one exported pure function next to the entity, or the presenter calls the entity rule; no `policies/` folder); (b) `TaskDescription` and `TaskTeamIds` folded into `Task` validation (keeps `TaskTitle`, `TaskStatus`, `DueDate`; error classes and codes unchanged); (c) `application/views/` removed: the view type moves into `ports/task.read-model.ts`, assembly (team chips from `TeamLookup`) into the presenter or the get/list use cases; (e) `UpdateTaskDto extends CreateTaskDto`, `task-fields.ts` removed, `TeamChipDto` inside `task-response.dto.ts`; (g) `task.persistence-mapper.ts` → private functions in `task.prisma-repository.ts`.
- **Done when:** unit, integration and e2e green; `pnpm arch` green; OpenAPI document unchanged; overview §3, §4 and §6 updated (no policies, views or mapper files).

## T-008-11 — Tests inside each module

- **Goal:** a module's tests live with the module (AC-08.11).
- **Changes:** `src/modules/<m>/tests/{unit,integration,e2e}/`: unit specs move out of the source folders; module-specific integration and e2e suites move from `apps/api/test/{integration,e2e}`; cross-cutting suites (auth, health, docs, route inventory and protection, security baseline, throttling, architecture, telemetry, probes) and `test/support` stay in `apps/api/test`. Jest projects (`roots`/`testMatch`), coverage `collectFromFiles`/exclusions, `tsconfig` includes and the build (tests never in `dist`) updated; dependency-cruiser `no-tests-in-production` treats `src/modules/*/tests/**` as test code and the layer rules ignore it (Gantry). Only paths and imports change; no assertion changes.
- **Done when:** the three Jest projects run the same number of tests as before (counts in the PR); coverage gates unchanged; `pnpm arch` and its meta-tests green (a fixture proves production code importing `tests/` fails); `dist/` holds no test file; overview §6 and the test strategy updated.

## T-008-12 — Remove explanatory code comments

- **Goal:** code reads without commentary; the why lives in the ADRs and README (AC-08.12).
- **Changes:** remove comments in `apps/api/src` and `apps/api/test` (and the module `tests/` folders), keeping only functional ones: `eslint-disable*`, `@ts-expect-error` / `@ts-ignore`, triple-slash directives and tool pragmas (`istanbul`, `prettier-ignore`, `webpackIgnore`-style). OpenAPI descriptions passed as decorator arguments are strings, not comments, and stay. A reasoning that only a comment held and that matters moves to the ADR, README or the operations docs in the same PR.
- **Done when:** a check (script or grep in the PR description) shows no `//` or `/* */` comments beyond the allowed kinds; lint, typecheck, all test projects and `pnpm arch` green; no behaviour change.
