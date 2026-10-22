# ADR-0014 — Testing strategy and tooling

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, qa-engineer

## Context

Tests are a primary evaluation criterion. Constitution §V requires test-first work, every BDD scenario covered by at least one automated test, a test pyramid, and integration tests on a real PostgreSQL. The vision sets targets: 100 % of brief acceptance criteria automated, domain ≥ 90 % line coverage, mutation score ≥ 80 %, list p95 < 100 ms.

## Decision drivers

- Fast feedback: most tests run in milliseconds without I/O.
- Realism where it matters: SQL, indexes, migrations and transactions tested against the real engine.
- Traceability from Gherkin scenario (`@AC-03.4.2`) to test.
- Measure test **quality**, not just coverage.
- Tooling native to each stack (Nest, Expo).

## Considered options

### Unit test runner (API)

- **Jest (chosen):** Nest CLI default, `@nestjs/testing` examples, ts-jest; same runner as the app (`jest-expo`).
- **Vitest:** faster, ESM-native; **−** diverges from Nest and Expo defaults, two runners in the monorepo.

### Database in integration tests

- **Testcontainers PostgreSQL (chosen):** real Postgres 17 per test run, migrations applied, isolated.
- **pg-mem / SQLite in-memory:** fast, **−** no partial/trigram indexes, different SQL semantics — false confidence.
- **Shared docker-compose DB:** **−** state leaks between runs and developers.

### Mobile E2E

- **Maestro (chosen):** YAML flows, works with Expo Go/dev builds, little flakiness, readable by non-developers.
- **Detox:** **−** requires a native build configuration (no Expo Go), more setup.

### BDD execution

- **Gherkin as specification, tagged tests (chosen):** scenarios live in `.feature` files; tests reference scenario tags in their names (`it("@AC-03.4.2 filters by status")`), and a CI script checks every tag has a test.
- **jest-cucumber step definitions:** **−** glue layer that slows writing tests and couples tests to wording.

## Decision outcome

| Level              | Tool                                            | Scope                                                                                                        | Target                                                                    |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Unit — domain      | Jest                                            | Aggregates, value objects, invariants, events                                                                | ≥ 90 % lines; **Stryker** mutation score ≥ 80 % on `src/modules/*/domain` |
| Unit — application | Jest + in-memory fake ports                     | Command/query handlers, error paths, event publishing                                                        | ≥ 85 % lines                                                              |
| Integration        | Jest + `@testcontainers/postgresql`             | Prisma repositories, read models, migrations (indexes exist), seed idempotency, transactions (team delete)   | All repositories                                                          |
| API E2E            | supertest on the full Nest app + Testcontainers | Every `@api` scenario: auth, ownership 404, validation 400, envelopes, ETag/412, idempotency, pagination     | 100 % of `@api @must`                                                     |
| Component          | jest-expo + React Native Testing Library + MSW  | Screens and components: form validation (title ≥ 3), chips, quick actions, optimistic rollback               | ≥ 80 % lines in `src/features`                                            |
| Mobile E2E         | Maestro                                         | Happy paths: sign in, create task, change status, filter by team, offline toggle                             | `@mobile @must` flows                                                     |
| Contract           | CI drift check                                  | `openapi.json` + generated client match DTOs ([ADR-0008](0008-class-validator-dtos-and-generated-client.md)) | Always                                                                    |
| Architecture       | dependency-cruiser                              | Layering rules ([overview §7](../overview.md#7-dependency-rules-enforced-by-dependency-cruiser-in-ci))       | Zero violations                                                           |
| Load               | k6                                              | Seeded list/search/status scenarios                                                                          | `GET /tasks` p95 < 100 ms locally                                         |

Conventions:

- **Test-first:** a task's PR adds failing tests for its scenarios before (or with) the implementation; reviewers check tags.
- **Builders/object mothers** for aggregates and DTOs (`aTask().withStatus("DONE").build()`), fixed clock and id generator ports for determinism.
- **No mocks of what we own in integration tests;** mocks only at process boundaries (HTTP via MSW in the app).
- **Coverage gates** enforced in Jest config (`coverageThreshold`) per package; CI fails below threshold.
- Integration and E2E suites run with `--runInBand` and one container per worker; CI caches the Postgres image.
- Maestro runs locally/nightly on an emulator; not a merge gate (emulators in CI are slow and flaky).

## Consequences

**Positive**

- The bulk of tests are fast and deterministic; DB behavior is verified for real.
- Mutation testing proves domain tests actually assert behavior.
- Every acceptance criterion is traceable to a test by tag.

**Negative**

- Testcontainers requires Docker in CI and locally (already required to run the project).
- Stryker runs are slow; limited to the domain folder and to CI on `main` / nightly plus on PRs touching `domain/`.
- The API's Jest scripts run with `NODE_OPTIONS=--experimental-vm-modules` (set through `cross-env`, so they also work in Windows shells; added with T-001-06). `better-auth`, `@better-auth/expo` and `@thallesp/nestjs-better-auth` ship ESM only. Node 24 loads them from the CommonJS build at runtime (`require(esm)`), but Jest's module loader needs VM modules to do the same. **Drop the flag** once those packages ship CommonJS, Jest loads ESM from CommonJS without it, or the API moves to ESM. Nothing else depends on the flag.

**Neutral**

- Visual regression (Storybook snapshots) is optional and not gated.

## Links

- [Constitution §V](../../constitution.md#v-quality)
- Testcontainers: https://node.testcontainers.org/modules/postgresql/ · Stryker: https://stryker-mutator.io · Maestro: https://maestro.dev · k6: https://grafana.com/docs/k6/
