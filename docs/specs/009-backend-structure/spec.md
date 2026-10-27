# 009 — Backend structure

- **Decision:** [ADR-0020](../../architecture/adr/0020-simplify-architecture-for-the-hiring-test.md) (amended 2026-10-26) · **Status:** Approved (user, 2026-10-26) · **Priority:** SHOULD (before presenting the submission)

## Problem

After 008 the `tasks` and `teams` modules are layered and the domain is pure, but three couplings remain and the tree is deeper than it needs to be:

- `tasks/application` imports a concrete class of another module (`TeamLookup` from `teams/team-lookup.service.ts`); dependency-cruiser allows it through a `*-lookup.service.ts` exception.
- Presentation computes a business rule: `task.presenter.ts` calls `Task.isOverdue` and `DueDate` from the domain.
- Every module keeps a table "domain error → HTTP" in `presentation/http/*-error.mapping.ts` and registers it by hand in `onModuleInit`, so adding an error means touching three places.

A reviewer reads `presentation/http/presenters/`, `application/ports/` and a per-module error table before reaching the request path.

## Goals / Non-goals

**Goals**

- One flat layout per module: `presentation/{dto, controller}`, `application/{use-cases, interfaces}`, `domain`, `infrastructure/persistence`.
- No module knows another module's implementation; the module file is the only place that wires them.
- Presentation talks to application only; business rules are computed in application or domain.
- Domain errors carry their own public meaning (code, kind, message, details) without knowing HTTP; one filter maps kind → status.
- The rules above are enforced by dependency-cruiser, so they cannot come back.

**Non-goals**

- Any change to the HTTP contract, the OpenAPI document or the generated api-client.
- Changes to the database schema, the seed or the mobile app.
- Reshaping `identity` (a Better Auth adapter with guards, middleware and hooks, no domain or use cases) or `health`.

## Coupling audit (main `be8136a`)

| #   | Finding                                                                                                                                                                                        | Target                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| C1  | domain → application / infrastructure / presentation: none (`domain-is-pure`).                                                                                                                 | Keep.                                                                                                     |
| C2  | application → infrastructure / presentation: none (`application-not-to-adapters`).                                                                                                             | Keep.                                                                                                     |
| C3  | `tasks/application` imports the concrete `TeamLookup` (create, update, get, list use cases) and `TeamSummary` (`task.read-model.ts`, `task.presenter.ts`) from `teams/team-lookup.service.ts`. | Tasks declares `TeamDirectory`; `tasks.module.ts` binds it to `TeamLookup`.                               |
| C4  | `task.presenter.ts` imports `Task` and `DueDate` to compute `isOverdue` and sorts the team chips.                                                                                              | The use case returns `isOverdue` and sorted teams in `TaskView`; the response DTO maps with `from(view)`. |
| C5  | Five task DTOs import `TaskStatus` from `domain/value-objects/task-status.vo.ts` (enum for validation and OpenAPI).                                                                            | DTOs import the status values through `application/interfaces`.                                           |
| C6  | `task-error.mapping.ts` / `team-error.mapping.ts` import the domain errors; `tasks.module.ts` and `teams.module.ts` register them in `DomainErrorMappings` on `onModuleInit`.                  | Errors carry `code` / `kind` / message / `details`; one `GlobalExceptionFilter` maps kind → status.       |
| C7  | Controllers and `@CurrentOwner()` import `Owner` from `shared/domain/owner.ts`; the exception filter imports `DomainError` from `shared/domain`.                                               | Allowed: the shared kernel is not a module's domain (see AC-09.4).                                        |

## Target layout

```
modules/tasks/
├── domain/                                   # unchanged: entities, value-objects, errors, repositories
├── application/
│   ├── use-cases/                            # the six use cases
│   └── interfaces/
│       ├── task-read-model.interface.ts      # TaskReadModel + TaskView / TaskRecord / ListTasksCriteria + status values
│       └── team-directory.interface.ts       # TeamDirectory + TeamSummary: what tasks needs from teams, declared by tasks
├── infrastructure/persistence/               # implements the domain repository and the read model
├── presentation/
│   ├── dto/                                  # requests + responses; each response DTO has static from(view)
│   └── tasks.controller.ts
├── tests/{unit,integration,e2e}/
└── tasks.module.ts                           # composition root: { provide: TeamDirectory, useExisting: TeamLookup }

modules/teams/
├── domain/
├── application/
│   ├── use-cases/
│   ├── interfaces/team-read-model.interface.ts
│   └── team-lookup.service.ts                # exported by TeamsModule
├── infrastructure/persistence/
├── presentation/{dto/, teams.controller.ts}
├── tests/{unit,integration,e2e}/
└── teams.module.ts
```

Removed: `presentation/http/`, `presenters/`, `*-error.mapping.ts`, `application/ports/`, `shared/presentation/filters/domain-error-mappings.ts` and the modules' `onModuleInit`.

## Requirements

- **R-1 (contract unchanged).** Every status, error code, message and `details` of [api-contracts](../../architecture/api-contracts.md) stays the same; the integration and e2e suites pass without changing their assertions.
- **R-2 (one PR, atomic commits).** One commit per task in [tasks.md](tasks.md); lint, typecheck, unit tests and `pnpm arch` are green at each commit.

## Acceptance criteria

- **AC-09.1** Given the API built from this branch, then the OpenAPI document is byte-identical to `main` (`tools/ci/api-client-drift.sh` reports no diff) and the integration and e2e suites pass with their assertions unchanged.
- **AC-09.2** Given the `tasks` and `teams` modules, then each has only `domain/`, `application/{use-cases,interfaces}/`, `infrastructure/persistence/`, `presentation/{dto/,<x>s.controller.ts}`, `tests/` and `<x>s.module.ts` (plus `teams/application/team-lookup.service.ts`); there is no `presentation/http/`, `presenters/`, `application/ports/` or `*-error.mapping.ts`.
- **AC-09.3** Given any file of a module other than its `<x>s.module.ts`, then it imports nothing from another module; the module file may import only the other module's `<y>s.module.ts` and the provider that module exports. `grep -rn "teams/" apps/api/src/modules/tasks --exclude-dir=tests` finds only `tasks.module.ts`.
- **AC-09.4** Given a file under `modules/<m>/presentation/`, then it imports nothing from `modules/<m>/domain/`; the shared kernel (`shared/domain`: `DomainError`, `Owner`) stays allowed.
- **AC-09.5** Given a file under `modules/<m>/application/`, then it imports nothing from another module.
- **AC-09.6** Given a domain error, then it declares a stable `code`, a `kind` (`validation` | `not_found` | `conflict` | `rule`), a fixed public message and optional `details`, and imports nothing from HTTP or Nest; the `GlobalExceptionFilter` maps `validation → 400`, `not_found → 404`, `conflict → 409`, `rule → 422` in one place, and the error responses in OpenAPI come from the declared errors.
- **AC-09.7** Given `tasks.module.ts`, then `TeamDirectory` resolves to the `TeamLookup` exported by `TeamsModule`, and a unit test proves the binding.
- **AC-09.8** Given dependency-cruiser, when a fixture breaks AC-09.3, AC-09.4 or AC-09.5, then `pnpm arch` fails with the rule name (`contexts-isolated`, `presentation-not-to-domain`, `application-not-to-other-modules`), and the `*-lookup.service.ts` exception is gone.

## Out of scope

- New endpoints, fields or error codes.
- `identity` and `health` folder layout.
- Specs 001–008 and their features: they stay as the record.

## Open questions

- None. C5 and C7 were not in the first audit: C5 is closed by exposing the status values through `application/interfaces`; C7 is allowed by design (shared kernel).
