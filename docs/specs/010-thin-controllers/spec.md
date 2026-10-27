# 010 — Thin controllers

- **Decision:** [ADR-0020](../../architecture/adr/0020-simplify-architecture-for-the-hiring-test.md) (layout line amended 2026-10-26) · **Status:** Approved (user, 2026-10-26) · **Priority:** SHOULD (before presenting the submission)

## Problem

After 009 the controllers are the longest files of each module, and most of their lines are not request handling:

- Each route stacks three to four Swagger decorators with long hand-written error descriptions, so the handler is hard to find.
- Every `:id` route repeats `@Param('id', ParseUuidPipe)`, a custom pipe that rebuilds the `VALIDATION_FAILED` body the global `ValidationPipe` already produces for DTOs.
- Write routes call the write use case, then `GetXUseCase` again to build the response (create, update, change status), so the controller orchestrates a read after the write.

## Goals / Non-goals

**Goals**

- A controller method reads as: route, one doc decorator, parameters, one or two lines (`execute` + `XResponseDto.from`).
- Per-route OpenAPI lives in `presentation/docs/<x>s.docs.ts`, one composed decorator per route built with `applyDecorators`.
- `:id` is validated like every other input: a class-validator param DTO through the global pipe.
- Write use cases return the view they changed; the controller never reads after a write.

**Non-goals**

- Any change to the HTTP contract, the OpenAPI document or the generated api-client.
- Replacing `static from(view)` with `class-transformer` `plainToInstance`: `from()` is type-checked against the view, while `plainToInstance` needs `@Expose` / `@Type` / `@Transform` on every field and silently drops or passes through what it does not know.
- Moving the `Location` header out of the create routes, or the list query → criteria mapping out of the list routes.

## Requirements

- **R-1 (contract unchanged).** Same statuses, codes, messages, `details`, headers (`Location` on create) and bodies as [api-contracts](../../architecture/api-contracts.md); the integration and e2e suites pass without changing an assertion.
- **R-2 (one PR, atomic commits).** One commit per task in [tasks.md](tasks.md); lint, typecheck, unit tests and `pnpm arch` green at each commit.

## Acceptance criteria

- **AC-10.1** Given the API built from this branch, then `tools/ci/api-client-drift.sh` reports no diff, and no assertion of an integration or e2e spec changes.
- **AC-10.2** Given `tasks.controller.ts` and `teams.controller.ts`, then each route method carries exactly one OpenAPI decorator, imported from `presentation/docs/<x>s.docs.ts` and composed with `applyDecorators` (the class keeps at most one as well); routing decorators (`@Get`, `@Post`, `@HttpCode`, …) stay on the method.
- **AC-10.3** Given a request whose `:id` is not a UUID, then the answer is the same as today: `400 VALIDATION_FAILED` with `details: [{ field: 'id', message: 'id must be a UUID' }]`, produced by a param DTO (`@Param() { id }: IdParamDto`) through the global `ValidationPipe`; the same strings are accepted and rejected as with `ParseUuidPipe`; an invalid `:id` with a valid body reports the `id` error; with an invalid body the body error wins, as with `ParseUuidPipe`.
- **AC-10.4** Given no route uses it, then `ParseUuidPipe` and its spec are removed.
- **AC-10.5** Given the create, update and change-status use cases of tasks and the create and update use cases of teams, then each returns the view of the entity it wrote, built with the same mapping as the get use case (team chips, `isOverdue`, task count); delete still returns nothing.
- **AC-10.6** Given a controller write method, then it calls one use case and maps its result with `XResponseDto.from`; no controller calls a `Get…UseCase` after a write. Create also sets `Location` (AC-10.7).
- **AC-10.7** Given a create route, then it is marked `@Location()` and takes no `@Res()`; after the handler returns, `LocationInterceptor` sets `Location` from the declared route, never from the request: the global prefix and default version that `configureRouting()` applies (`shared/presentation/routing.ts`), the controller's and the handler's path metadata (and a declared `@Version`), then `/` and the returned body's `id`. So `POST /API/V1/TASKS/?x=1` still answers `/api/v1/tasks/<id>` (and `/api/v1/teams/<id>`), with no hard-coded path; the header stays exposed through CORS, and none is set when the body has no string `id`.
- **AC-10.8** Given any route method of `tasks.controller.ts` and `teams.controller.ts`, then it is one `const` holding the use case result followed by one `return XResponseDto.from(…)` (delete: one `await`, no return). List maps the query with `List…QueryDto.toCriteria()` and the page with `…PageResponseDto.from(found, query)`; the list OpenAPI schema stays `ApiPageEnvelope` and is unchanged.

## Out of scope

- `identity` and `health` controllers.
- New endpoints, fields or error codes.

## Open questions

- None.
