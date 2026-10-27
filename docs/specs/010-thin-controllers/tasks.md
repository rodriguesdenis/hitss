# 010 — Tasks

One PR, one commit per task, in this order. `docs/010-thin-controllers-spec` (T-010-00) is stacked under `refactor/010-thin-controllers` (T-010-01 to T-010-05). Lint, typecheck, unit tests and `pnpm arch` stay green at every commit; integration, e2e, compose smoke and the `contract` drift job run in CI.

| ID       | Task                                                   | Owner                        | Depends on | Commit scope              |
| -------- | ------------------------------------------------------ | ---------------------------- | ---------- | ------------------------- |
| T-010-00 | Spec, tasks and ADR-0020 layout line                   | software-architect (Trestle) | —          | `docs(spec)`, `docs(adr)` |
| T-010-01 | Route docs in `presentation/docs/`, one per route      | nestjs-specialist (Forge)    | 00         | `refactor(api)`           |
| T-010-02 | `:id` param DTO through the global pipe                | nestjs-specialist (Forge)    | 01         | `refactor(api)`           |
| T-010-03 | Write use cases return the view; controllers 1–2 lines | nestjs-specialist (Forge)    | 02         | `refactor(api)`           |
| T-010-04 | `@Location()` decorator and interceptor                | nestjs-specialist (Forge)    | 03         | `refactor(api)`           |
| T-010-05 | List criteria and page DTOs; one return pattern        | nestjs-specialist (Forge)    | 04         | `refactor(api)`           |

## T-010-00 — Spec and ADR

- **Changes:** `docs/specs/010-thin-controllers/{spec,tasks}.md`; ADR-0020 tree gains `presentation/docs/`; specs index row; traceability regenerated.
- **Done when:** the spec lists AC-10.1 to AC-10.6.

## T-010-01 — Route docs

- **Changes:** `tasks/presentation/docs/tasks.docs.ts` and `teams/presentation/docs/teams.docs.ts` export one `applyDecorators` per route (`ApiCreateTask`, `ApiListTasks`, …) holding today's envelope and error decorators with the same descriptions, and one for the class (`ApiTags` + `401`/`429`); controllers use them.
- **Covers:** AC-10.1, AC-10.2.
- **Done when:** OpenAPI identical (drift job); the `*.openapi.spec.ts` suites pass unchanged.

## T-010-02 — Param DTO

- **Changes:** a shared `IdParamDto` (`@IsUUID` with the version `ParseUuidPipe` accepts, message `id must be a UUID`) used as `@Param() { id }: IdParamDto`, declared before `@Body()`; remove `ParseUuidPipe` and its spec; a unit spec pins the `400` body and the accept/reject cases (nil, v4, v7, upper case, too short).
- **Covers:** AC-10.3, AC-10.4.
- **Done when:** e2e "id is not a UUID" cases pass unchanged.

## T-010-03 — Write use cases return the view

- **Changes:** tasks create / update / change-status and teams create / update return the view, reusing the get use case's mapping (`toTaskView` with `TeamDirectory` and the clock; the team view with its task count); controllers become `execute` + `XResponseDto.from` (+ `Location` on create); use-case specs assert the returned view; controller specs, if any, drop the get stub.
- **Covers:** AC-10.5, AC-10.6.
- **Done when:** no `Get…UseCase` injected into a controller is called by a write method; e2e bodies unchanged.

## T-010-04 — `@Location()`

- **Changes:** `shared/presentation/decorators/location.decorator.ts` (`UseInterceptors(LocationInterceptor)`) and `interceptors/location.interceptor.ts`; tasks and teams create use `@Location()` and drop `@Res()` and `setHeader`; an interceptor unit spec covers paths with a query string and a trailing slash, and bodies without an `id`.
- **Covers:** AC-10.7.
- **Done when:** the e2e `Location` assertions pass unchanged; `Location` is still in the CORS exposed headers.

## T-010-05 — One return pattern

- **Changes:** `ListTasksQueryDto.toCriteria()` / `ListTeamsQueryDto.toCriteria()`, `TaskPageResponseDto.from` / `TeamPageResponseDto.from`; `ListTeamsUseCase` takes `{ ownerId, criteria }` like tasks; every route method is one `const` and one `return`.
- **Covers:** AC-10.8.
- **Done when:** OpenAPI identical (drift job); unit specs cover `toCriteria()` and the page DTOs.
