# Specs (Spec-Driven Development)

Each feature lives in `docs/specs/<NNN>-<slug>/` with four artifacts, written in this order:

| #   | File             | Answers                                                                                            | Owner                           |
| --- | ---------------- | -------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | `spec.md`        | **What & why.** Problem, stories, acceptance criteria, out of scope. No technology names.          | product-owner                   |
| 2   | `<slug>.feature` | **Behavior.** Gherkin scenarios derived from acceptance criteria.                                  | qa-engineer                     |
| 3   | `plan.md`        | **How.** Architecture, contracts, data, security, observability, test approach — referencing ADRs. | software-architect + specialist |
| 4   | `tasks.md`       | **Steps.** Ordered, atomic tasks; each task = one PR.                                              | specialist + git-pr-manager     |

A task is **Ready** when its spec, scenarios and plan are approved. It is **Done** per [definition of done](../quality/definition-of-done.md).

## Index

| Spec                                             | Epic                                     | Scope                                                                                               |
| ------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [001-auth](001-auth/spec.md)                     | EP-01 Identity & Access                  | Sign up / sign in / sign out, sessions, route protection, ownership                                 |
| [002-teams](002-teams/spec.md)                   | EP-02 Team Management                    | Team CRUD, listing with metadata                                                                    |
| [003-tasks](003-tasks/spec.md)                   | EP-03 Task Management                    | Task CRUD, status, multi-team assignment, filters/search/sort/pagination                            |
| [004-mobile-app](004-mobile-app/spec.md)         | EP-04 Mobile Experience                  | Screens, navigation, forms, chips, theming, a11y, i18n                                              |
| [005-offline-sync](005-offline-sync/spec.md)     | EP-05 Offline & Responsiveness           | Offline cache, optimistic updates, mutation queue                                                   |
| [006-observability](006-observability/spec.md)   | EP-06 Observability & Operations         | Traces, metrics, logs, health, load test                                                            |
| [007-ci-and-dx](007-ci-and-dx/spec.md)           | EP-07 Quality, CI & Developer Experience | Docker one-command run, seeds, CI, architecture rules, contract drift                               |
| [008-simplification](008-simplification/spec.md) | ADR-0020                                 | Simplify the backend for the hiring test: Bearer-only, no CQRS/CLS/ETag, slim telemetry, fewer docs |

## ID conventions

- **Epic:** `EP-0N` — file `docs/product/epics/EP-0N-<slug>.md`.
- **User story:** `US-<epic>.<n>` e.g. `US-03.4`. Defined in the epic, detailed in the spec.
- **Acceptance criterion:** `AC-<epic>.<story>.<n>` e.g. `AC-03.4.2`.
- **Priority tag:** `MUST` (brief), `SHOULD` (brief differential), `COULD` (our extra).
- **Scenario tags:** `@US-03.4 @AC-03.4.2 @must` (+ `@api` / `@mobile`).
- **Task:** `T-<spec>-<nn>` e.g. `T-003-07`. Branch `<type>/<spec>-<slug>`, e.g. `feat/003-list-filters`.

## Templates

### spec.md

```markdown
# <NNN> — <Feature name>

- **Epic:** EP-0N · **Status:** Draft | Approved · **Priority:** MUST/SHOULD/COULD

## Problem

## Goals / Non-goals

## User stories

### US-0N.1 — <title> (`MUST`)

As a <persona>, I want <capability>, so that <outcome>.

**Acceptance criteria**

- **AC-0N.1.1** Given … when … then …

## Business rules

| ID | Rule |

## Edge cases

## Out of scope

## Open questions
```

### `<slug>.feature`

```gherkin
@api
Feature: <name>
  <one-paragraph narrative>

  Background:
    Given I am signed in as "marina@example.com"

  Rule: <business rule>

    @US-0N.1 @AC-0N.1.1 @must
    Scenario: <behavior>
      Given …
      When …
      Then …
```

Declarative style (business behavior, not clicks or HTTP minutiae unless the contract itself is the behavior). Use `Scenario Outline` for boundaries.

### plan.md

```markdown
# <NNN> — Technical plan

## Context & references (spec, ADRs)

## Architecture (components, layers, sequence diagram in Mermaid)

## Contract (endpoints / screens; link to api-contracts.md, no duplication)

## Data (schema changes, migrations, indexes)

## Security considerations

## Observability (spans, metrics, logs)

## Testing approach (which scenarios at which level)

## Risks & mitigations
```

### tasks.md

```markdown
# <NNN> — Tasks

| ID  | Task | Depends on | Size | Branch |
| --- | ---- | ---------- | ---- | ------ |

## T-NNN-01 — <imperative title>

- **Goal:** …
- **Changes:** files/areas touched
- **Covers:** @AC-… scenarios
- **Done when:** concrete, verifiable checks
```

Sizes: **S** < 150 changed lines, **M** < 400. Anything larger must be split.

## ADR index

Decisions live in [`../architecture/adr/`](../architecture/adr/) (MADR format):

| ADR                                                                           | Decision                                                                |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [0001](../architecture/adr/0001-monorepo-pnpm-turborepo.md)                   | Monorepo with pnpm workspaces + Turborepo                               |
| [0002](../architecture/adr/0002-nestjs-clean-architecture-ddd-cqrs.md)        | NestJS with Clean Architecture, DDD and CQRS                            |
| [0003](../architecture/adr/0003-postgresql.md)                                | PostgreSQL as the database                                              |
| [0004](../architecture/adr/0004-prisma-migrations-and-seeding.md)             | Prisma ORM, migrations and deterministic seeding                        |
| [0005](../architecture/adr/0005-rest-openapi-and-response-envelope.md)        | REST + OpenAPI with response/error envelopes                            |
| [0006](../architecture/adr/0006-offset-pagination.md)                         | Offset pagination (vs cursor)                                           |
| [0007](../architecture/adr/0007-better-auth.md)                               | Better Auth for authentication                                          |
| [0008](../architecture/adr/0008-class-validator-dtos-and-generated-client.md) | class-validator DTOs as contract source + orval client                  |
| [0009](../architecture/adr/0009-expo-and-expo-router.md)                      | Expo (managed, Expo Go) + Expo Router                                   |
| [0010](../architecture/adr/0010-react-query-and-zustand-immer.md)             | React Query for server state, Zustand + immer for local state           |
| [0011](../architecture/adr/0011-nativewind-with-apply.md)                     | NativeWind v4 with `@apply` semantic classes                            |
| [0012](../architecture/adr/0012-offline-first-and-optimistic-updates.md)      | Offline-first persistence (AsyncStorage adapter) and optimistic updates |
| [0013](../architecture/adr/0013-opentelemetry-and-signoz.md)                  | OpenTelemetry + SigNoz                                                  |
| [0014](../architecture/adr/0014-testing-strategy.md)                          | Testing strategy and tooling                                            |
| [0015](../architecture/adr/0015-optimistic-concurrency.md)                    | Optimistic concurrency with `version` + ETag/If-Match                   |
| [0016](../architecture/adr/0016-soft-delete.md)                               | Soft delete                                                             |
| [0017](../architecture/adr/0017-conventional-commits-and-atomic-prs.md)       | Conventional Commits and atomic PRs                                     |
| [0018](../architecture/adr/0018-docker-compose-one-command-run.md)            | Docker Compose one-command run                                          |
| [0019](../architecture/adr/0019-idempotency-keys.md)                          | Idempotency keys on POST                                                |
