# Roadmap

How the work is sequenced, what "done" means at each milestone, and what blocks what. Priorities follow MoSCoW (see the [vision](vision.md)); order follows dependencies. Source-of-truth precedence: constitution > ADRs > architecture docs > specs.

## Phases

| Phase | Name                  | Scope                                                                                                  | Status      |
| ----- | --------------------- | ------------------------------------------------------------------------------------------------------ | ----------- |
| 0     | Foundation            | Repo, agents, project guide, constitution                                                              | ✔ Done      |
| 1     | Docs                  | Vision, epics, domain/data model, API contracts, ADRs, specs, BDD features, plans, tasks               | ✔ Done      |
| 2     | Backend               | 007 foundations → 001 auth → 002 teams → 003 tasks → 006 observability                                 | Not started |
| 3     | Mobile                | 004 mobile app → 005 offline sync                                                                      | Not started |
| 4     | CI / README hardening | Contract-drift, mutation testing, compose smoke, request collections, final README and operations docs | Not started |

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

| Now                                                                   | Next                                                        | Later                                                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 007: compose + Postgres, validated config, CI skeleton (M1)           | 003 tasks API, MUST stories first (M4)                      | 005 offline sync (M7)                                                                      |
| 001: foundation tasks, Better Auth, global guard, `CurrentOwner` (M2) | 006 health probes + telemetry; start 004 UI kit in parallel | COULD polish: theme, i18n, a11y, sort UI, sign-up/sign-out UX, Storybook, mutation testing |
| 002: teams API (M3)                                                   | 004 mobile MUST screens (M6)                                | k6 load test, SigNoz dashboards, MMKV adapter                                              |

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
