# ADR-0002 — NestJS with Clean Architecture, DDD and CQRS

- **Status:** Accepted, partly superseded by [ADR-0020](0020-simplify-architecture-for-the-hiring-test.md)
- **Superseded (2026-10-22):** CQRS (commands, queries, buses), module `contracts/` with QueryBus adapters, the unit of work and the in-transaction / after-commit event publication — see ADR-0020.
- **Date:** 2026-10-20
- **Deciders:** software-architect, nestjs-specialist

## Context

The API is small (two aggregates, ~12 endpoints) but it is evaluated on architectural clarity, testability and how well it would grow. The domain has real rules (name uniqueness per owner, 0–10 teams per task, `completedAt` tied to status, free status transitions, ownership scoping) and one cross-context interaction (deleting a team unassigns it from tasks). We want those rules testable without a database or HTTP, and the framework used idiomatically rather than fought.

## Decision drivers

- Business rules unit-testable in milliseconds (target: domain ≥ 90 % coverage, mutation score ≥ 80 %).
- Use NestJS conventions and official packages before custom code (constitution §III.4, §IX.2).
- Layering that is **enforced by tooling**, not by review alone (constitution §III.3).
- Bounded contexts (Identity, Team Management, Task Management) that do not reach into each other's persistence (constitution §II.2).
- Proportionate: no ceremony that does not pay for itself in this codebase.

## Considered options

### 1. NestJS 11 + Clean Architecture per module + `@nestjs/cqrs` (chosen)

- **+** Nest gives DI, modules, guards, pipes, interceptors, filters and first-party packages (`@nestjs/config`, `@nestjs/swagger`, `@nestjs/terminus`, `@nestjs/throttler`, `@nestjs/cqrs`) — all widely known to reviewers.
- **+** `@nestjs/cqrs` turns each use case into an explicit `Command`/`Query` + handler: one file per use case, trivially unit-testable with fake ports.
- **+** `EventBus` gives in-process domain events without new infrastructure.
- **−** More files than a controller → service → ORM design.
- **−** Two models (domain aggregate and Prisma row) require mappers.

### 2. Classic Nest "service + repository" (controller → service → Prisma)

- **+** Least code; the Nest docs default.
- **−** Business rules leak into services intertwined with Prisma calls; unit tests need ORM mocks; no structural guard against a controller calling Prisma.

### 3. Lighter framework (Fastify/Hono + hand-wired DI)

- **+** Smaller runtime, faster cold start.
- **−** Re-implements validation, OpenAPI, health, throttling and DI that Nest already provides; less familiar layout for reviewers.

### 4. Full hexagonal with a separate domain package and event sourcing

- **−** Over-engineered for the scope; event sourcing adds projections and replay with no requirement asking for an audit log.

## Decision outcome

**NestJS 11**, one Nest module per bounded context (`identity`, `teams`, `tasks`) plus `health`, each split into four layers:

| Layer             | Contains                                                                                                                                                                                                                      | May import                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `domain/`         | Aggregates (`Team`, `Task`), value objects, domain events, domain errors, and the aggregate's **repository port** (`<agg>.repository.ts`, an `abstract class` with only domain types). Pure TypeScript.                       | `shared/domain` only                                   |
| `application/`    | Commands, queries and their handlers (= use cases); every **other port** (read models, cross-context ports, clock, id generator, metrics) declared as `abstract class` (usable directly as Nest DI tokens, no string tokens). | `domain/`, `@nestjs/cqrs`, `@nestjs/common` decorators |
| `infrastructure/` | Prisma repositories (implementing the domain repository ports), mappers, adapters for application ports (read models, cross-context ports), clock, id generator.                                                              | `application/`, `domain/`, `@prisma/*`                 |
| `presentation/`   | Controllers, class-validator DTOs, Swagger decorators.                                                                                                                                                                        | `application/` (via buses), shared presentation        |

Rules:

- **Writes** go through `CommandBus`; handlers load an aggregate from its repository port (declared in the domain, implemented in infrastructure), call aggregate methods (no setters), save it when a method reported a change (persistence increments `version`, ADR-0015), then publish the aggregate's pulled domain events.
- **Reads** go through `QueryBus`; query handlers use a read-model port that returns view DTOs directly (no aggregate hydration needed for lists). This is the "CQRS-lite" split: same database, separate code paths.
- **Cross-context calls** use the buses and the target module's `contracts/` folder. Task Management's `TeamDirectory` port is implemented by an adapter that sends `GetTeamSummariesQuery`; Team Management's `taskCount` uses a `TeamTaskCounts` port whose adapter sends `CountTasksByTeamQuery`. Modules never import each other's providers, so there is no DI cycle.
- **Errors**: the domain throws typed `DomainError`s; a global exception filter maps them to the error envelope ([ADR-0005](0005-rest-openapi-and-response-envelope.md)).
- **Enforcement**: `dependency-cruiser` rules A1–A9 ([overview §7](../overview.md#7-dependency-rules-enforced-by-dependency-cruiser-in-ci)) run in CI.

### TeamDeleted consistency

Deleting a team must also remove its `task_teams` rows. Two ways to propagate `TeamDeleted`:

|                  | Same transaction (chosen)                                              | Asynchronous (outbox + worker)                                       |
| ---------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Consistency      | Atomic: team soft-deleted and assignments removed, or neither.         | Eventual: for a short window tasks still show a deleted team's chip. |
| Infrastructure   | None beyond Postgres.                                                  | Outbox table, relay/worker, retries, idempotent consumers.           |
| Coupling in time | Delete latency includes the unassign `DELETE` (one indexed statement). | Delete returns immediately.                                          |
| Failure mode     | Whole request fails and rolls back.                                    | Consumer can fail independently; needs monitoring/dead letters.      |

The `DeleteTeamHandler` runs inside a unit of work: the Prisma interactive transaction is propagated through async context (`@nestjs-cls/transactional` with its Prisma adapter), so every repository used during the request — including Task Management's — joins the same transaction. Because `@nestjs/cqrs` `EventBus.publish` does **not** await handlers, `TeamDeleted` is dispatched by a small awaited in-transaction publisher to its _transactional_ subscribers (Task Management's `OnTeamDeletedHandler`) before commit; after commit, the event is also published on the `EventBus` for non-critical side effects (metrics, logs). The cross-context contract is still the event, so Team Management has no compile-time knowledge of tasks.

At this scale (one process, one database) the atomic option is simpler and strictly more correct. A **transactional outbox** is the documented production evolution once contexts are split into services or the reaction becomes slow.

## Consequences

**Positive**

- Domain and handler tests run without Nest, Prisma or Postgres; use cases read like the spec.
- Each use case is one folder (command, handler, spec), so PRs stay small ([ADR-0017](0017-conventional-commits-and-atomic-prs.md)).
- Contexts can later be extracted (buses → messaging) without rewriting the domain.

**Negative**

- More files and mappers than a CRUD service; mitigated by a consistent folder template.
- Two dispatch paths for events (in-transaction vs. post-commit) must be documented and tested.
- `@nestjs-cls/transactional` is an extra (community, widely used) dependency.

**Neutral**

- The application layer imports `@nestjs/cqrs` decorators; we accept this framework coupling there (not in the domain) because it keeps handlers idiomatic.

## Links

- [Domain model](../domain-model.md) · [Architecture overview](../overview.md)
- [ADR-0004 — Prisma](0004-prisma-migrations-and-seeding.md) · [ADR-0014 — Testing strategy](0014-testing-strategy.md)
- NestJS CQRS: https://docs.nestjs.com/recipes/cqrs · dependency-cruiser: https://github.com/sverweij/dependency-cruiser
