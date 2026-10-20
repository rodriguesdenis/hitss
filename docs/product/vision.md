# Product Vision

## Elevator pitch

**Teams & Tasks** is a mobile app, backed by a REST API, that lets a person organize their work into **tasks** and group those tasks under color-coded **teams**. A task can belong to zero, one or many teams, so the same piece of work can be seen from every team it concerns.

## Context

This product is the deliverable of a fullstack hiring test (original brief: [`docs/brief/`](../brief/)). The evaluation focuses on **code quality, architectural clarity, tests, minimal UX and documented decisions**. The vision therefore has two audiences:

| Audience                           | What success looks like                                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **End user** (persona below)       | Creates, finds and updates tasks in seconds, even with a flaky connection.                                                 |
| **Evaluator** (technical reviewer) | Runs the project with one command, understands every key decision in minutes, finds production-grade practices throughout. |

## Persona

**Marina, team lead** — coordinates work across a few small teams (e.g. _Mobile_, _Backend_, _Design_). Uses her phone between meetings. Needs to see "what is pending for team X", mark things done quickly and capture new tasks before she forgets them. Often on unreliable mobile networks.

## Problems we solve

1. Work spans teams — a single task often concerns more than one team.
2. Finding the right tasks fast (by team, status, text) on a small screen.
3. Updating status must be instant, even offline.

## Scope

### MUST (from the brief)

- Team CRUD; listing returns pagination metadata.
- Task CRUD with status `Pending | In progress | Done`; a task belongs to zero or more teams.
- Task listing with filters `teamId`, `status`, `search`, sorting and pagination.
- Mobile screens: teams list (tap filters tasks), tasks list (global and per team), create/edit task form with validation (title ≥ 3 chars), task detail with quick actions (change status, delete), team color shown as chip on tasks.
- Server state with React Query; styling without styled-components; forms with react-hook-form + zod.
- Seeds (3 teams, 10 tasks); README with decisions, data model, how to run, request examples, production notes.

### SHOULD (brief's differentials)

- Offline-first; optimistic updates.
- Backend unit + integration tests; frontend component tests.
- Scripts `start`, `test`, `seed`.

### COULD (our extras — senior-level signals)

- Authentication (Better Auth) with per-user data ownership.
- Observability: OpenTelemetry + SigNoz, structured logs, health checks.
- Production-grade API: OpenAPI, versioning, idempotency keys, optimistic concurrency (ETag/If-Match), soft delete, rate limiting.
- Generated, type-safe API client (orval); architecture rules enforced in CI.
- App quality: dark/light theme, accessibility, i18n (pt/en), Storybook, Maestro E2E.
- CI (GitHub Actions), Bruno collection, k6 load test, mutation testing.

### Out of scope

- Deployment / CD (the project runs locally via Docker).
- Collaboration between users (sharing teams, assigning tasks to people), notifications, attachments, comments.
- Web front-end (the Expo app may run on web, but it is not a target).

## Success metrics

| Metric                                               | Target                                    |
| ---------------------------------------------------- | ----------------------------------------- |
| Time from clone to running API with seed             | < 5 min, one command                      |
| Brief acceptance criteria covered by automated tests | 100 %                                     |
| API p95 latency for task listing (local, seeded)     | < 100 ms                                  |
| Status change perceived latency in the app           | instant (optimistic), rollback on failure |
| Domain layer test coverage                           | ≥ 90 % lines, mutation score ≥ 80 %       |

## Guiding principles

See the [constitution](../constitution.md). In short: spec first, domain at the center, contract as code, one command to run, every decision written down.
