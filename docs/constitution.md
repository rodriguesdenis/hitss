# Project Constitution

The non-negotiable principles of **Teams & Tasks**. Every spec, plan, task and pull request must comply. Changing a principle requires an ADR.

## I. Spec-Driven Development

1. **No code without a spec.** Work starts from an approved task in `docs/specs/<id>-<feature>/tasks.md`.
2. **The flow is fixed:** `spec.md` (what & why) → `*.feature` (behavior) → `plan.md` (how) → `tasks.md` (steps) → implementation → review → PR.
3. **Specs describe behavior, plans describe technology.** A spec never names a library; a plan always references the ADRs it relies on.
4. **Specs are living documents.** If implementation reveals a gap, update the spec first, then the code.

## II. Domain-Driven Design

1. **Ubiquitous language** (see [domain model](architecture/domain-model.md#ubiquitous-language)) is used identically in docs, code, API and UI copy.
2. **Bounded contexts:** Identity, Team Management, Task Management. Contexts communicate through application services or domain events, never by reaching into each other's persistence.
3. **Aggregates protect invariants.** State changes go through aggregate methods; no public setters. Aggregates reference other aggregates **by id only**.
4. **Value objects** model concepts with rules (`TaskTitle`, `TeamName`, `ColorHex`, `TaskStatus`). Invalid values cannot be constructed.

## III. Clean Architecture

1. **Dependencies point inward:** `presentation → application → domain` and `infrastructure → application/domain`. The domain imports nothing from NestJS, Prisma or any I/O library.
2. **Ports and adapters:** the application layer declares ports (repositories, clock, id generator); infrastructure implements them.
3. **Rules are enforced by tooling**, not by discipline alone (`dependency-cruiser` in CI).
4. **Frameworks are details,** but we use them idiomatically: NestJS conventions in the API, Expo conventions in the app.

## IV. Contracts

1. The API's NestJS DTOs are the **single source of truth** for the contract → OpenAPI → generated client (`packages/api-client`). The app never hand-writes API types.
2. Every response uses the envelope `{ data, meta? }`; every error uses `{ error: { code, message, details?, traceId } }` with a stable, documented `code` (see [API contracts](architecture/api-contracts.md#conventions)).
3. Breaking changes require a new API version (`/api/v2`).

## V. Quality

1. **Test-first.** Each BDD scenario is covered by at least one automated test before the task is done.
2. **Test pyramid:** most tests are fast unit tests of domain and application; integration tests run against a real PostgreSQL (Testcontainers); a thin layer of E2E.
3. **Strict TypeScript** everywhere (`strict`, `noUncheckedIndexedAccess`, no `any`).
4. **Definition of Done** ([quality/definition-of-done.md](quality/definition-of-done.md)) applies to every task.

## VI. Security by default

1. Every API route requires authentication unless explicitly marked public (health, docs, auth).
2. **Every query is scoped by the owner.** Accessing another user's resource returns `404`, never `403` (no existence leak).
3. Input is validated at the boundary (whitelist, length limits, formats); secrets come only from the environment; logs never contain credentials.

## VII. Operability

1. **One command to run:** with only Docker installed, `docker compose up` yields a migrated, seeded, healthy API.
2. Observability is built in (OpenTelemetry traces, metrics, structured logs with trace correlation) but **optional at runtime**: the API works without a collector.
3. Configuration is validated at startup; the app fails fast on invalid config.

## VIII. Delivery

1. **Atomic pull requests:** one task, one concern, small enough to review in under 15 minutes.
2. **Conventional Commits**, each commit builds and passes tests (bisectable history).
3. CI must be green to merge: lint, typecheck, tests, build, architecture rules, contract drift, dependency audit.

## IX. Simplicity

1. Build what the specs ask for, done well. Extras (COULD) never compromise required features (MUST).
2. Prefer boring, well-supported technology and ecosystem packages over custom infrastructure.
3. Every non-obvious decision is written down as an ADR, including what we chose **not** to do.
