# 009 — Tasks

One PR, one commit per task, in this order. `docs/009-backend-structure-spec` (T-009-00) is stacked under `refactor/009-backend-structure` (T-009-01 to T-009-07). Lint, typecheck, unit tests and `pnpm arch` stay green at every commit; integration, e2e, compose smoke and the `contract` drift job run in CI.

| ID       | Task                                                              | Owner                        | Depends on | Commit scope              |
| -------- | ----------------------------------------------------------------- | ---------------------------- | ---------- | ------------------------- |
| T-009-00 | Spec, tasks and ADR-0020 amendment                                | software-architect (Trestle) | —          | `docs(spec)`, `docs(adr)` |
| T-009-01 | `application/ports` → `application/interfaces`                    | nestjs-specialist (Forge)    | 00         | `refactor(api)`           |
| T-009-02 | `TeamDirectory` in tasks, bound in `tasks.module.ts`              | nestjs-specialist (Forge)    | 01         | `refactor(api)`           |
| T-009-03 | Presenters → `ResponseDto.from(view)`, `isOverdue` in application | nestjs-specialist (Forge)    | 02         | `refactor(api)`           |
| T-009-04 | Errors with `code` / `kind`, one filter, no mapping tables        | nestjs-specialist (Forge)    | 03         | `refactor(api)`           |
| T-009-05 | Flatten `presentation/http/` to `presentation/`                   | nestjs-specialist (Forge)    | 04         | `refactor(api)`           |
| T-009-06 | dependency-cruiser rules and fixtures                             | nestjs-specialist (Forge)    | 05         | `refactor(api)` or `ci`   |
| T-009-07 | Architecture docs follow the code                                 | nestjs-specialist (Forge)    | 06         | `docs`                    |

## T-009-00 — Spec and ADR

- **Changes:** `docs/specs/009-backend-structure/{spec,tasks}.md`; ADR-0020 layout and dependency rules; specs index row.
- **Done when:** the spec lists the audit, target layout and AC-09.1 to AC-09.8; ADR-0020 shows the new tree and the rules.

## T-009-01 — Ports become interfaces

- **Changes:** `application/ports/<x>.read-model.ts` → `application/interfaces/<x>-read-model.interface.ts` in tasks and teams; imports updated; `TeamLookup` moves to `teams/application/team-lookup.service.ts`.
- **Covers:** AC-09.2 (partly).
- **Done when:** no `ports/` folder; tests green with only import paths changed.

## T-009-02 — TeamDirectory

- **Changes:** `tasks/application/interfaces/team-directory.interface.ts` declares `abstract class TeamDirectory` with the calls the use cases make today (`summaries`, `findMissing`, `assertAllLive`) and `TeamSummary`; create, update, get and list use cases and the task read model depend on it; `tasks.module.ts` provides `{ provide: TeamDirectory, useExisting: TeamLookup }`; `tasks.module.spec.ts` asserts the binding; use-case specs fake `TeamDirectory`.
- **Covers:** AC-09.3, AC-09.5, AC-09.7.
- **Done when:** `grep -rn "teams/" apps/api/src/modules/tasks --exclude-dir=tests` finds only `tasks.module.ts`.

## T-009-03 — Response DTOs map views

- **Changes:** `TaskView` carries `isOverdue` (computed in the use case with the domain rule and the clock) and teams sorted as the presenter sorts them today; `TaskResponseDto.from(view)` and `TeamResponseDto.from(view)` replace the presenters; presenter specs become `from()` specs; DTOs take the status values from `application/interfaces` (audit C5).
- **Covers:** AC-09.4.
- **Done when:** no `presenters/` folder and no import of `modules/<m>/domain/` under `presentation/`; response bodies unchanged.

## T-009-04 — Errors carry their meaning

- **Changes:** `shared/domain/domain-error.ts` gains `code`, `kind`, a fixed public message and optional `details`; each task and team error declares them with today's values; `GlobalExceptionFilter` maps kind → status in one place and keeps the `VALIDATION_FAILED` envelope for `validation`; `@ApiErrorResponses` reads the declared errors; delete `*-error.mapping.ts`, `DomainErrorMappings`, its module wiring and the modules' `onModuleInit`; mapping specs become a filter spec per kind plus one case per domain error (code and status).
- **Covers:** AC-09.1, AC-09.6.
- **Done when:** e2e and integration green with assertions unchanged; OpenAPI identical.

## T-009-05 — Flat presentation

- **Changes:** `presentation/http/{dto,<x>s.controller.ts}` → `presentation/{dto,<x>s.controller.ts}` in tasks and teams; test folders follow.
- **Covers:** AC-09.2.
- **Done when:** no `presentation/http/` folder under `modules/`.

## T-009-06 — Architecture rules

- **Changes:** `apps/api/.dependency-cruiser.cjs`: `contexts-isolated` allows another module only from `<m>.module.ts`, and only to `<y>.module.ts` or the provider `<y>` exports, with no `*-lookup.service.ts` exception; new `presentation-not-to-domain` (module domain only, shared kernel allowed); new `application-not-to-other-modules`; header comment paths updated; a violating fixture per new or changed rule in `test/architecture/rules.test.mjs`.
- **Covers:** AC-09.3, AC-09.4, AC-09.5, AC-09.8.
- **Done when:** `pnpm arch` green; each fixture fails with its rule name.

## T-009-07 — Docs follow the code

- **Changes:** `docs/architecture/overview.md` (module diagram, layer diagram, folder tree, request lifecycle), `docs/architecture/design-notes.md` (the why: `TeamDirectory` owned by tasks, errors carry kind, `from(view)`), `docs/constitution.md` §2 wording on cross-module access if it still names `TeamLookup` as the access point.
- **Done when:** no doc outside `docs/specs/00[1-8]` and the ADR archive mentions `presenters/`, `ports/`, `presentation/http/` or per-module error tables.
