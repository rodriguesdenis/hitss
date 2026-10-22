# ADR-0020 — Simplify the architecture for the hiring test

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** user (product owner of the submission), software-architect, nestjs-specialist, database-specialist
- **Supersedes in part:** [ADR-0002](0002-nestjs-clean-architecture-ddd-cqrs.md) (CQRS, buses, module contracts, unit of work), [ADR-0007](0007-better-auth.md) (cookie sessions and CSRF on `/api/v1`), [ADR-0013](archive/0013-opentelemetry-and-signoz.md) (custom telemetry machinery), [ADR-0015](archive/0015-optimistic-concurrency.md) (ETag / `If-Match`)

## Context and problem statement

The brief asks for two CRUD resources (teams and tasks) with filters, pagination, a seed and a one-command run. The backend now on `main` meets every MUST requirement, but it grew machinery that a reviewer has to read through before reaching the domain:

- `@nestjs/cqrs` commands, queries and buses for about a dozen use cases; module `contracts/` and QueryBus adapters between two modules of one process;
- a CLS-propagated unit of work, in-transaction and after-commit event publication and a per-team advisory lock, all to keep one `DELETE /teams/:id` atomic;
- cookie sessions on the business API, and with them a CSRF guard, Origin checks and a JSON-only body guard;
- ETag / `If-Match` / `412` with a retry-once policy on top of the version column;
- custom telemetry code (sanitizing span exporter, metric views, a `@Traced` decorator with its guard spec, a diagnostics logger, a telemetry lifecycle hook).

Each piece was reasoned and tested, but together they cost more reading time than they buy for this scope. The submission is judged on clarity as much as on correctness, so the cost now outweighs the benefit.

## Decision drivers

- A reviewer understands a request path from controller to SQL in a few minutes.
- Every brief requirement stays met, and the brief's end-to-end contract stays green on every PR.
- Keep what demonstrates senior judgement: four layers with an enforced dependency rule, a real domain (entities, value objects, invariants), owner isolation, soft delete, indexes, tests at three levels, one-command run.
- Remove what only pays off for several services, many writers or browser clients.

## Considered options

1. **Keep the current architecture** and document it better. Rejected: the reading cost stays.
2. **Collapse to controller → service → Prisma.** Rejected: loses the domain rules' testability and the layering the brief evaluates.
3. **Simplify while keeping the four layers (chosen).**

## Decision outcome

Option 3. Per module (amended 2026-10-22 twice: in T-008-09 to the tree the code settled on, then by the user-approved addendum T-008-10 to T-008-12, which removes policies, views and mapper files and moves tests into the module):

```
modules/<x>s/
├── domain/
│   ├── entities/<x>.entity.ts            # create() validates new data; restore() rebuilds from storage;
│   │                                     # simple field rules and derived facts (Task.isOverdue) live here
│   ├── value-objects/<y>.vo.ts           # only concepts with real rules: TaskTitle, TaskStatus, DueDate,
│   │                                     # TeamName, ColorHex
│   ├── errors/<x>.errors.ts
│   └── repositories/<x>.repository.ts    # abstract class (DI token), domain types only
├── application/
│   ├── use-cases/<verb>-<x>.use-case.ts  # one class, execute(input: plain TS type)
│   └── ports/<x>.read-model.ts           # query side: view types and pages, implemented by SQL
├── presentation/http/
│   ├── <x>s.controller.ts
│   ├── dto/                              # class-validator requests (update extends create),
│   │                                     # <x>-response.dto.ts with @ApiProperty
│   └── presenters/<x>.presenter.ts       # explicit view → response mapping (and assembly, e.g. team chips)
├── infrastructure/persistence/
│   ├── <x>.prisma-repository.ts          # row ⇄ entity mapping as private functions in this file
│   └── <x>.prisma-read.ts                # implements the read model
├── tests/{unit,integration,e2e}/         # the module's own tests; cross-cutting ones stay in apps/api/test
├── <x>-lookup.service.ts                 # only when other modules need it (teams: TeamLookup)
└── <x>s.module.ts
shared/
├── domain/                               # DomainError, Clock, Owner
├── application/page.ts                   # Page<T>, PageRequest, Sort
├── infrastructure/prisma/prisma.service.ts
├── presentation/                         # envelope interceptor, exception filter + per-module error tables,
│                                         # pipes, validators, pagination query DTO, @CurrentOwner(),
│                                         # OpenAPI envelope decorators (they register their extra models)
└── observability/                        # pino logger config
```

**Removed**

| Removed                                                                                                | Replaced by                                                                                                                |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `@nestjs/cqrs`, commands, queries, buses                                                               | Use-case classes injected into controllers                                                                                 |
| Module `contracts/` and QueryBus adapters                                                              | `TeamsModule` exports a small `TeamLookup` service that `TasksModule` injects                                              |
| `nestjs-cls`, unit of work, in-transaction / after-commit events, advisory link lock                   | `DeleteTeam` runs one `prisma.$transaction`: soft-delete the team and delete its `task_teams` rows                         |
| Cookie auth on `/api/v1`, CSRF guard, Origin checks, JSON-body guard (`415`), cookie scheme in OpenAPI | Bearer tokens only on `/api/v1` (Better Auth `bearer` plugin); Better Auth keeps its own cookie handling on `/api/auth/*`  |
| ETag, `If-Match`, `412`, retry-once                                                                    | Plain last-write-wins updates; `version` stays as data                                                                     |
| Sanitizing exporter, metric views, `@Traced` + guard, diagnostics logger, telemetry lifecycle          | One `instrumentation.ts` with OTel auto-instrumentation, exporting OTLP **only when** `OTEL_EXPORTER_OTLP_ENDPOINT` is set |

**Kept**

- Four layers and the dependency rule, enforced by dependency-cruiser (rules rewritten for the new paths).
- Entities and value objects carrying the brief's rules; no `class-transformer` in the domain; global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform).
- Envelope `{ data, meta }` / `{ error }`, Better Auth with Bearer tokens and owner isolation (another user's resource → `404`).
- Prisma + PostgreSQL, indexes, soft delete, seed, `docker compose up`.
- One global per-IP throttler plus Better Auth's own limiter.
- pino JSON logs with request id, trace id and redaction; `/health/live` and `/health/ready`; OpenAPI at `/docs`.
- Unit, integration and e2e tests; the brief's e2e contract green on every PR.

**Code comments** (addendum, T-008-12): source and test files carry no explanatory comments; only functional ones stay (`eslint-disable`, `@ts-expect-error`, triple-slash and tool pragmas). The why lives in the ADRs and the README.

**Docs and CI**

- Docs shrink to the README, about six essential ADRs and one architecture document. Specs, BDD features and the traceability matrix stay as optional process material.
- The traceability, README and production-readiness doc checks leave the CI gate. The gate keeps lint, typecheck, unit, integration, e2e, build, compose smoke, gitleaks and the dependency audit.

## Consequences

**Positive**

- One obvious path per request; about a third fewer files and several fewer runtime dependencies.
- Still layered and testable: domain rules and use cases are unit-tested without Nest or a database.

**Negative**

- No lost-update protection: two clients editing the same task concurrently get last-write-wins. Accepted for a single-user task app; the `version` column keeps the door open.
- A team deleted while a concurrent task write links it can leave a link to a soft-deleted team. Reads already hide deleted teams, so it is invisible; a periodic cleanup or a re-check inside the task write would close it if needed.
- Browser clients must send a Bearer token instead of relying on a cookie.
- Telemetry is plain auto-instrumentation: no custom redaction of span attributes, so the exporter must stay off (the default) wherever span data could hold user input.

## Links

- Specification and plan: [008 — Simplification](../../specs/008-simplification/spec.md)
- Superseded parts: [ADR-0002](0002-nestjs-clean-architecture-ddd-cqrs.md) · [ADR-0007](0007-better-auth.md) · [ADR-0013](archive/0013-opentelemetry-and-signoz.md) · [ADR-0015](archive/0015-optimistic-concurrency.md)
