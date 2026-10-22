# Roadmap

How the work is sequenced, what "done" means at each milestone, and what blocks what. Priorities follow MoSCoW (see the [vision](vision.md)); order follows dependencies. Source-of-truth precedence: constitution > ADRs > architecture docs > specs.

## Phases

| Phase | Name                  | Scope                                                                                                  | Status                                                          |
| ----- | --------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 0     | Foundation            | Repo, agents, project guide, constitution                                                              | ✔ Done                                                          |
| 1     | Docs                  | Vision, epics, domain/data model, API contracts, ADRs, specs, BDD features, plans, tasks               | ✔ Done                                                          |
| 2     | Backend               | 007 foundations → 001 auth → 002 teams → 003 tasks → 006 observability                                 | In progress (foundations done; MUST endpoints next)             |
| 3     | Mobile                | 004 mobile app → 005 offline sync                                                                      | Not started                                                     |
| 4     | CI / README hardening | Contract-drift, mutation testing, compose smoke, request collections, final README and operations docs | Partly done (CI gate, smoke in review); rest after the MUST API |

## Milestones and exit criteria

| Milestone                  | Includes                                                                                                                | Exit criteria                                                                                                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1 — Runnable skeleton** | 007: T-007-01…03 (compose + Postgres, validated config, CI skeleton)                                                    | `docker compose up` starts Postgres; the API config fails fast on invalid env; CI runs lint, typecheck, unit tests, build and commitlint on a PR.                                                                                                         |
| **M2 — Secure API base**   | 001 (all MUST stories: US-01.2, 01.4, 01.5, 01.6, 01.8) + 007 T-007-04 seed                                             | Every non-public route returns `401` without a session; sign-in works with the demo account; the route-inventory test passes; production config rules (AC-01.8.5) have unit tests; the CSRF guard and the per-address throttle run before the auth guard. |
| **M3 — Teams API**         | 002 MUST stories (US-02.1–02.3, 02.5–02.7, 02.11)                                                                       | Team CRUD, pagination metadata and search work end to end; two-user isolation scenarios (US-02.11) pass; every MUST AC has a passing scenario tagged with its id.                                                                                         |
| **M4 — Tasks API**         | 003 MUST stories (US-03.1–03.13 except 03.14–03.16)                                                                     | Task CRUD, `teamId` / `status` / `search` / sort / pagination, team-delete unassignment and owner isolation (US-03.12) pass; seed gives 3 teams and 10 tasks to the demo user; list p95 < 100 ms on seed.                                                 |
| **M5 — API complete**      | COULD items of 001–003 (rate limits, ETag, idempotency, overdue, taskCount) + 006                                       | Health probes, tracing/logs/metrics, SigNoz profile and the production-readiness plan (US-06.8, MUST) are in; k6 smoke passes.                                                                                                                            |
| **M6 — Mobile MUST**       | 004 US-04.1–04.9 (sign-in, teams list + CRUD, tasks list, status filter + search, detail, form, chips, feedback states) | An evaluator signs in as the demo user in Expo Go and completes every brief journey; every MUST AC of 004 is covered by a component test or Maestro flow tagged with its id.                                                                              |
| **M7 — Offline**           | 005 (SHOULD)                                                                                                            | Status change and delete are instant with rollback; creates/edits work offline and replay after restart; conflicts are explained; offline Maestro flow passes.                                                                                            |
| **M8 — Release candidate** | Phase 4: US-07.4/07.8/07.9 etc., README final, COULD polish (theme, i18n, a11y, sort, sign-up UX)                       | Fresh clone → one command → seeded API in < 5 min; CI green including compose smoke and contract drift; README covers decisions, data model, how to run, request examples and production notes.                                                           |

## Status (2026-10-22)

**User decision for the current phase: MUST only.** COULD and optional work is deferred until the MUST API is complete and demo-able (constitution IX.1). Mobile (Phase 3) starts in a later session.

| Milestone                  | Status      | Done (tasks with `Status: done`)                                                                                                                                                                                                                                | Left                                                                              |
| -------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **M1 — Runnable skeleton** | ✔ Done      | T-007-01…03, plus T-007-04 (API image, one-shot `migrate` service), T-007-05 (architecture rules), T-007-06 (integration job, coverage gates, traceability), T-007-08 (scripts + Makefile), T-007-11 (supply chain), T-007-16/17 (doc check, `--require-tests`) | —                                                                                 |
| **M2 — Secure API base**   | In progress | T-001-01…06 (config, Prisma, HTTP conventions, security baseline, identity schema, Better Auth), T-001-10 (client IP + auth limiter)                                                                                                                            | T-001-07, 08, 09 (`@CurrentOwner` in `shared/presentation`, CO-1), 11, 14, 15     |
| **M3 — Teams API**         | In progress | T-002-01…03 (schema, domain, repository)                                                                                                                                                                                                                        | MUST endpoints below                                                              |
| **M4 — Tasks API**         | In progress | T-003-01…04 (schema, value objects, aggregate, repository)                                                                                                                                                                                                      | MUST endpoints below                                                              |
| **M5 — API complete**      | Partly done | T-006-01, 02, 04, 05 (OpenTelemetry bootstrap, pino logging, use-case spans, metrics); boot-time database probe                                                                                                                                                 | T-006-03 readiness, T-006-08 operations docs (US-06.8 is MUST); the rest deferred |

In review (not yet on `main`): T-007-09 compose smoke, T-007-18 telemetry hand-off in the smoke, T-003-06 read model (parked).

### Next milestone — MUST API, per spec

| Spec              | MUST tasks left                                                                                                                                                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 001 auth          | T-001-07 sign-up rules · T-001-08 global auth guard, CSRF guard, liveness, route inventory · T-001-09 `CurrentOwner` + two-user helper · T-001-11 demo user seed · T-001-14 auth hardening · T-001-15 per-IP / per-user throttlers                                                        |
| 002 teams         | T-002-04 create · T-002-06 list (pagination, search, sort) · T-002-07 get (the ETag part is deferred) · T-002-08 replace (the `If-Match` part is deferred) · T-002-09 unit of work + delete with in-transaction unassignment · T-002-10 contracts / `TeamTaskCounts` · T-002-11 team seed |
| 003 tasks         | T-003-05 `TeamDirectory` · T-003-06 read model + get · T-003-07 create · T-003-08 list filters + pagination · T-003-09 search + sort · T-003-10 replace · T-003-11 change status · T-003-12 delete · T-003-13 `OnTeamDeleted` · T-003-14 `CountTasksByTeamQuery` · T-003-15 task seed     |
| 006 observability | T-006-03 readiness (`/health/live` never touches the DB; `/health/ready` reuses the boot probe with 1.5 s) · T-006-08 operations docs                                                                                                                                                     |
| 007 CI / DX       | T-007-07 deterministic seed · T-007-09 compose smoke (in review) · T-007-14 request collections · T-007-15 README final                                                                                                                                                                   |

**Deferred by user decision (after the MUST API):** T-001-12 auth observability, T-001-13 auth request collection + OpenAPI security schemes (folded into T-007-14/15 where needed), T-002-05 idempotency keys, ETag/`If-Match` (T-002-07/08 parts, T-003-17), T-003-18 task idempotency, T-002-12 / T-003-16 extra telemetry, T-006-06 SigNoz profile, T-006-07 k6, T-007-10 contract drift (needs the mobile API client), T-007-12 mutation testing, T-007-13 mobile Metro, and all of 004/005 (mobile, offline).

## Critical path

The longest dependency chain that gates the MUST scope (arrows = "depends on"):

```
T-007-01 → T-007-02 → T-001-01 → T-001-02 → T-001-05 → T-001-06 → T-001-08 → T-001-09
  → T-002-04 → T-002-06/07 → T-002-10 (TeamDirectory) → T-003-05 → T-003-06 → T-003-07/08
  → (api-client generation T-004-04) → T-004-05 → T-004-06 → … → T-004-13 → T-004-15 → T-004-16 → T-005-01
```

Cross-spec dependencies to watch:

| Dependency                                                                 | Why it matters                                                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| T-001-01 → 007 scaffold; T-006-01 → **T-007-02** (validated config)        | Observability bootstraps from the validated config; production rules (S-M7) are added to T-007-02's schema by 001 tasks. |
| T-001-08 (auth guard + CSRF guard) → every business endpoint               | No team/task endpoint ships without the global guard; T-001-09 (`CurrentOwner`) precedes T-002-04.                       |
| T-001-10 (limiters) before the auth guard in the chain                     | Per-address throttle must run before authentication (AC-01.7.9); per-user after.                                         |
| T-002-01 → T-001-05; T-002-11 → T-001-11                                   | Team schema needs identity tables; team seed needs the demo user.                                                        |
| T-002-10 (`TeamDirectory`) → T-003-05; T-003-13 (`TeamDeleted`) → T-002-09 | Tasks validate teams through the directory; deleting a team unassigns tasks (MUST, US-03.13).                            |
| T-003-14 (`taskCount`, COULD) ↔ T-002-10                                   | `TaskCountReader` is provisional until 003 ships.                                                                        |
| T-002-05 (shared idempotency store) → T-003-18                             | Task idempotency reuses the store; the key is route-bound (AC-02.10.10).                                                 |
| T-007-04 → T-006-03 (health probes)                                        | The compose healthcheck needs the probes.                                                                                |
| T-007-07 (seed) → 001/002/003 schemas and seeds                            | Single deterministic seed needs all three schemas; `SEED_DEMO` and production guard (AC-01.8.4).                         |
| T-004-04 (orval client) → stable OpenAPI of 001–003                        | Mobile cannot start screens before the API contract is exported; T-007-10 (drift check) guards it.                       |
| T-004-12 (team form) → T-004-16 (task form)                                | Task form selects teams; both are MUST after D34.                                                                        |
| T-005-01 → T-004-16                                                        | Offline layer sits on the finished MUST screens.                                                                         |
| T-007-14 / T-007-15 → all endpoints / T-006-08                             | Request collections and final README close the project.                                                                  |

Parallelism: 006 (T-006-02…05) can proceed alongside 002/003 once T-006-01 lands; 004 UI kit (T-004-01…03, 08, 09) can start while the backend is in progress, before the API client is generated.

## Now / Next / Later

| Now                                                                                   | Next                                                                                   | Later                                                                                                    |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| MUST API: 001 guards + `CurrentOwner`, 002 team endpoints, 003 task endpoints (M2–M4) | Seed, readiness, request collections, README final, operations docs (M5/M8 MUST parts) | Deferred COULD work (idempotency, ETag, SigNoz, k6, mutation testing), then mobile (M6) and offline (M7) |

## Brief → story validation

Each requirement from the brief (summarised in the [vision](vision.md#scope)) maps to at least one MUST/SHOULD story. Result: **all requirements covered.**

| Brief requirement                                                       | Level  | Stories                                                 |
| ----------------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| Team CRUD via API and interface                                         | MUST   | US-02.1, 02.5, 02.6, 02.7 (API); US-04.2, 04.3 (UI)     |
| Team listing returns pagination metadata (+ suggested `search`)         | MUST   | US-02.2, 02.3                                           |
| Task CRUD with status `Pending / In progress / Done`                    | MUST   | US-03.1, 03.8–03.11                                     |
| A task belongs to zero or more teams                                    | MUST   | US-03.1, 03.9, 03.13                                    |
| Listing filters `teamId`, `status`, `search`, sort, pagination          | MUST   | US-03.2–03.7 (API); US-04.5 (UI status filter + search) |
| Teams list; tap filters tasks                                           | MUST   | US-04.2                                                 |
| Tasks list global and per team                                          | MUST   | US-04.4                                                 |
| Create/edit task form, title ≥ 3 chars validation                       | MUST   | US-04.7                                                 |
| Task detail with quick actions (status, delete)                         | MUST   | US-04.6, US-03.10, 03.11                                |
| Team color shown as chip on tasks                                       | MUST   | US-04.8, US-03.2, 03.8                                  |
| Minimal UX: loading / empty / error / success                           | MUST   | US-04.9                                                 |
| Server state with React Query; no styled-components; RHF + zod          | MUST   | US-04.15 (verifiable constraints)                       |
| Seeds (3 teams, 10 tasks)                                               | MUST   | US-07.2, US-01.8, T-002-11, T-003-15                    |
| README: decisions, data model, how to run, request examples, prod notes | MUST   | US-07.1, US-07.4 (AC-07.4.5–07.4.9), US-06.8; T-007-15  |
| Offline-first; optimistic updates                                       | SHOULD | US-05.1–05.7                                            |
| Backend unit + integration tests; frontend component tests              | SHOULD | MUST-AC coverage criteria in EP-02/03/04, US-07.6       |
| Scripts `start`, `test`, `seed`                                         | SHOULD | US-07.3                                                 |

Validated against the full brief transcription in [`docs/brief/README.md`](../brief/README.md). Gaps found and closed: the mandated stack (React Query, react-hook-form + zod, no styled-components) now has verifiable ACs (US-04.15); the README content requirements have explicit ACs (AC-07.4.5–07.4.9). "Deploy backend on any platform" (optional differential) is deliberately not pursued.

## Risks to the schedule

| Risk                                                                 | Mitigation                                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Security hardening (CSRF guard, limiters, config rules) inflates 001 | Keep each as its own small task inside 001; none block 002 beyond T-001-09.                   |
| Mobile MUST grew (team CRUD, filters, sign-in)                       | UI kit and API client start early; sort, sign-up and theme/i18n/a11y stay COULD and are last. |
| Offline (SHOULD) competes with polish                                | 005 starts only after M6 exit criteria are met.                                               |
