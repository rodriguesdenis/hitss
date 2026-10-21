# Documentation map

Everything about **Teams & Tasks** lives here. Source-of-truth precedence when documents disagree: [constitution](constitution.md) > [ADRs](architecture/adr/README.md) > `docs/architecture/*.md` > specs.

## Where to start (suggested reading order for an evaluator)

1. [Product vision](product/vision.md) — what is built, for whom, and what is out of scope.
2. [Constitution](constitution.md) — the non-negotiable engineering principles.
3. [Architecture overview](architecture/overview.md) — C4 diagrams, folder structure, dependency rules, decision map.
4. [Domain model](architecture/domain-model.md) → [Data model](architecture/data-model.md) → [API contracts](architecture/api-contracts.md).
5. [ADR index](architecture/adr/README.md) — why each significant choice was made, with the alternatives rejected.
6. [Specs index](specs/README.md) — the Spec-Driven Development workflow and one spec per feature.
7. Quality, security, operations — [test strategy](quality/test-strategy.md), [threat model](security/threat-model.md), [production readiness](operations/production-readiness.md).

Looking for how to run the project? See the [root README](../README.md).

## Product

| Document                                                                                                                                                                                                                                                                                                                                                                                           | What it covers                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [product/vision.md](product/vision.md)                                                                                                                                                                                                                                                                                                                                                             | Elevator pitch, persona, scope, success metrics, guiding principles.                          |
| Epics: [EP-01](product/epics/EP-01-identity-and-access.md) · [EP-02](product/epics/EP-02-team-management.md) · [EP-03](product/epics/EP-03-task-management.md) · [EP-04](product/epics/EP-04-mobile-experience.md) · [EP-05](product/epics/EP-05-offline-and-responsiveness.md) · [EP-06](product/epics/EP-06-observability-and-operations.md) · [EP-07](product/epics/EP-07-quality-ci-and-dx.md) | One epic per theme: identity, teams, tasks, mobile, offline, observability, quality/CI/DX.    |
| [constitution.md](constitution.md)                                                                                                                                                                                                                                                                                                                                                                 | Project principles (architecture, quality, security, delivery) that every decision must obey. |

## Architecture

| Document                                                       | What it covers                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [architecture/overview.md](architecture/overview.md)           | System context, containers, API and mobile components, request lifecycle, folders, decision map. |
| [architecture/domain-model.md](architecture/domain-model.md)   | Bounded contexts, aggregates, value objects, domain events, invariants.                          |
| [architecture/data-model.md](architecture/data-model.md)       | ERD, relationships, indexes and why, soft delete, concurrency, migrations and seeding.           |
| [architecture/api-contracts.md](architecture/api-contracts.md) | Endpoints, envelopes, headers, pagination, error codes, cURL examples.                           |
| [architecture/adr/README.md](architecture/adr/README.md)       | Index of the 19 Architecture Decision Records (MADR) and when/how to write one.                  |

## Specs (Spec-Driven Development)

[specs/README.md](specs/README.md) explains the flow (`spec.md` → `*.feature` → `plan.md` → `tasks.md`) and lists every spec:

| Spec                                                 | Scope                                                     |
| ---------------------------------------------------- | --------------------------------------------------------- |
| [001-auth](specs/001-auth/spec.md)                   | Sign up / sign in / sign out, sessions, ownership         |
| [002-teams](specs/002-teams/spec.md)                 | Team CRUD and listing with metadata                       |
| [003-tasks](specs/003-tasks/spec.md)                 | Task CRUD, status, multi-team assignment, filters/search  |
| [004-mobile-app](specs/004-mobile-app/spec.md)       | Screens, navigation, forms, theming, accessibility, i18n  |
| [005-offline-sync](specs/005-offline-sync/spec.md)   | Offline cache, optimistic updates, mutation queue         |
| [006-observability](specs/006-observability/spec.md) | Traces, metrics, logs, health, load test                  |
| [007-ci-and-dx](specs/007-ci-and-dx/spec.md)         | CI pipeline, Docker one-command run, developer experience |

Each spec folder also holds its `plan.md` and `tasks.md`.

## Design

| Document                                       | What it covers                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| [design/design-spec.md](design/design-spec.md) | Design tokens, screen inventory and flows, components, states, dark mode, a11y, copy. |

## Quality and security

| Document                                                       | What it covers                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| [quality/test-strategy.md](quality/test-strategy.md)           | Test pyramid, tooling, test data, mutation testing, commands. |
| [quality/definition-of-done.md](quality/definition-of-done.md) | Definition of Ready and Done for tasks and PRs.               |
| [security/threat-model.md](security/threat-model.md)           | STRIDE threat model, mitigations and residual risks.          |

## Operations

| Document                                                                 | What it covers                                                               |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| [operations/runbook.md](operations/runbook.md)                           | Run, reset and troubleshoot locally (ports, Expo device, 401s, logs).        |
| [operations/observability.md](operations/observability.md)               | Traces, metrics, logs, health, running SigNoz, dashboards, alerts.           |
| [operations/production-readiness.md](operations/production-readiness.md) | "What I'd do differently in production": cache, logs, scalability, security. |
