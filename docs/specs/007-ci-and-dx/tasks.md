# 007 — Tasks

Each task is one PR. Sizes: **S** < 150 changed lines, **M** < 400 (lockfile and generated code excluded). Foundations (T-007-01…05) come **first**, before feature work in 001–005, so every later PR is verified by CI and runs in Docker. Late tasks (T-007-13…15) close the loop once features exist.

| ID       | Task                                                                                    | Depends on                             | Size | Branch                            |
| -------- | --------------------------------------------------------------------------------------- | -------------------------------------- | ---- | --------------------------------- |
| T-007-01 | Compose with PostgreSQL and `.env.example`                                              | —                                      | S    | `build/007-compose-postgres`      |
| T-007-02 | Validated API configuration (fail fast, local defaults)                                 | T-007-01                               | S    | `feat/007-config-validation`      |
| T-007-03 | CI skeleton: install, cache, commitlint, static checks, unit tests, build, `ci-success` | —                                      | M    | `ci/007-ci-skeleton`              |
| T-007-04 | API Dockerfile and compose `api` service (migrate → seed → start, healthcheck)          | T-007-01, T-007-02, T-006-03           | M    | `build/007-api-dockerfile`        |
| T-007-05 | dependency-cruiser architecture rules with meta-tests, in CI                            | T-007-03                               | M    | `ci/007-architecture-rules`       |
| T-007-06 | Integration tests job (Testcontainers), coverage gates and AC traceability check        | T-007-03                               | S    | `ci/007-integration-and-coverage` |
| T-007-07 | Deterministic, idempotent seed                                                          | T-007-04, 001/002/003 schema           | M    | `feat/007-deterministic-seed`     |
| T-007-08 | Root scripts and Makefile                                                               | T-007-04, T-007-07                     | S    | `build/007-scripts-makefile`      |
| T-007-09 | Compose smoke job in CI                                                                 | T-007-04, T-007-07                     | S    | `ci/007-compose-smoke`            |
| T-007-10 | Contract drift check (OpenAPI export + orval + diff)                                    | T-007-03, api-client package (003/004) | S    | `ci/007-contract-drift`           |
| T-007-11 | Supply chain: audit gate with expiring allowlist, Dependabot                            | T-007-03                               | S    | `ci/007-supply-chain`             |
| T-007-12 | Mutation testing workflow (Stryker on domain)                                           | T-007-03, domain code (002/003)        | S    | `ci/007-mutation-testing`         |
| T-007-13 | Optional mobile Metro service (profile `mobile`)                                        | T-007-01, 004 app scaffold             | S    | `build/007-mobile-dev-service`    |
| T-007-14 | Bruno collection and `.http` files, wired into compose smoke                            | T-007-09, 001/002/003 endpoints        | M    | `docs/007-request-collection`     |
| T-007-15 | README final: how to run, scripts, request examples, links                              | all above, T-006-08                    | M    | `docs/007-readme-final`           |

## T-007-01 — Compose with PostgreSQL and `.env.example`

- **Goal:** `docker compose up postgres` gives a healthy PostgreSQL 17 with defaults only.
- **Changes:** `docker-compose.yml` (`postgres` service, volume, `pg_isready` healthcheck, `${VAR:-default}` everywhere), `.env.example` (all variables, comments), `.gitattributes` (`*.sh text eol=lf`), `.dockerignore`, `tools/ci/env-example.test.mjs` (parity check).
- **Covers:** @AC-07.1.4 (partially), @AC-07.1.5 (DB port)
- **Done when:** with no `.env`, `docker compose up -d --wait postgres` is healthy; `POSTGRES_PORT=5433` works; parity test passes.

## T-007-02 — Validated API configuration

- **Goal:** one typed config, validated at start-up, failing fast with the variable name; safe local defaults; production refuses the default auth secret.
- **Changes:** `apps/api/src/infrastructure/config/` (schema, `ConfigModule.forRoot({ validate })`), `APP_ENV`, `PORT`, `DATABASE_URL`, `BETTER_AUTH_*`, `LOG_*`, `OTEL_*`, `RATE_LIMIT_MAX`, `SEED_ON_START`; `.env.example` sync.
- **Covers:** @AC-07.1.4, @AC-06.5.5
- **Done when:** unit tests: each invalid value → error naming it; `APP_ENV=production` + default secret → start refused; defaults yield a valid config.

## T-007-03 — CI skeleton

- **Goal:** every PR and push to main runs install (frozen lockfile, pnpm store cache, Turborepo cache), commitlint on the PR range, format check, lint, typecheck, unit tests, build; one aggregate `ci-success`.
- **Changes:** `.github/workflows/ci.yml`, `.github/actions/setup/action.yml`, `turbo.json` (cache dir, `arch`, `test:integration`, `generate` placeholders), concurrency group with cancel-in-progress for PRs, `permissions: contents: read`, actions pinned by SHA, job timeouts.
- **Covers:** @AC-07.6.1 (initial gates), @AC-07.6.2, @AC-07.6.3, @AC-07.6.4, @AC-07.6.7, @AC-07.9.2, @AC-07.10.1
- **Done when:** a green PR on the scaffold; a PR with commit `added stuff` fails `commitlint` and `ci-success`; a second push cancels the first run; a re-run with no changes shows Turborepo cache hits. Branch-protection recommendations shared with the repo owner.

## T-007-04 — API Dockerfile and compose `api` service

- **Goal:** `docker compose up` builds the API image (pruned, non-root), applies migrations, seeds (when enabled) and starts with instrumentation; healthy via `/api/v1/health/ready`.
- **Changes:** `apps/api/Dockerfile`, `apps/api/docker-entrypoint.sh`, compose `api` service (`depends_on: service_healthy`, healthcheck, `init`, `stop_grace_period`), `prisma` as prod dependency, seed compiled to `dist/prisma/seed.js` (stub until T-007-07), `pnpm.onlyBuiltDependencies`.
- **Covers:** @AC-07.1.1, @AC-07.1.2, @AC-07.1.6, @AC-07.1.7
- **Done when:** fresh clone → `docker compose up -d --build --wait` returns with `api` healthy; `docker compose exec api id -u` ≠ 0; image has no `src/`, `test/`, `.env`, `.git`; unreachable DB → container exits non-zero; image < 300 MB.

## T-007-05 — Architecture rules

- **Goal:** layering enforced by dependency-cruiser in API and mobile, with tests proving each rule fires.
- **Changes:** `apps/api/.dependency-cruiser.cjs`, `apps/mobile/.dependency-cruiser.cjs`, `arch` scripts + turbo task, `apps/api/test/architecture/{rules.spec.ts,fixtures/**}`, CI `static` job runs `turbo run arch`.
- **Covers:** @AC-07.7.1, @AC-07.7.2, @AC-07.7.3
- **Done when:** meta-test passes for every Examples row (rule name asserted); current code passes; `pnpm arch` locally = CI command.

## T-007-06 — Integration tests job, coverage gates and traceability check

- **Goal:** Testcontainers integration + supertest e2e in CI; coverage thresholds enforced; every `@must` AC has a test.
- **Changes:** CI `integration` job, `apps/api/jest.config.ts` + `jest.integration.config.ts` (`coverageThreshold` global 80 / domain 90), `jest-junit` reporters, artifact upload on failure; `tools/ci/traceability.mjs` (feature `@AC-` tags vs AC ids in test names) in the `static` job.
- **Covers:** @AC-07.6.1 (integration gate), @AC-07.6.5
- **Done when:** a PR lowering domain coverage under 90 % fails with the shortfall printed; integration suite green on `ubuntu-24.04`; removing the only test of a `@must` AC fails the traceability check.

## T-007-07 — Deterministic, idempotent seed

- **Goal:** demo user + 3 teams + 10 tasks with fixed ids; re-seed restores seeded rows, keeps others; reset works.
- **Changes:** `apps/api/prisma/seed.ts`, `apps/api/package.json` (`db:seed`, `db:reset`, `prisma.seed`), seed integration test.
- **Covers:** @AC-07.2.1, @AC-07.2.2, @AC-07.2.3, @AC-07.2.4, @AC-07.2.5, @AC-07.2.6, @AC-07.1.3
- **Done when:** integration test: seed ×2 → identical snapshot; rename "Mobile" + own task → re-seed restores "Mobile", keeps own task; reset → exactly 3/10; `SEED_ON_START=false` → no demo data.

## T-007-08 — Root scripts and Makefile

- **Goal:** brief scripts `start`, `test`, `seed` and the Docker-only aliases.
- **Changes:** root `package.json` scripts (`start`, `stop`, `test`, `seed`, `db:reset`, `arch`, `api-client:generate`), `Makefile` (`up`, `down`, `logs`, `seed`, `reset`, `test`, `test-docker`, `observability`, `observability-down`, `mobile`, `smoke`, `load`, `help`).
- **Covers:** @AC-07.3.1, @AC-07.3.2
- **Done when:** each target works on a clean clone (`make help` lists them); CI runs `make -n` for syntax.

## T-007-09 — Compose smoke job in CI

- **Goal:** prove the one-command run on every PR.
- **Changes:** `tools/ci/compose-smoke.sh`, CI job `compose-smoke` (up `--wait`, health/docs/sign-in/3 teams/10 tasks, non-root and image-content checks, unreachable-DB exit check, `API_PORT=3100` variant, logs on failure, `down -v` always).
- **Covers:** @AC-07.6.8, @AC-07.1.1, @AC-07.1.5, @AC-07.1.8 (duration recorded)
- **Done when:** job green on main; a PR breaking the entrypoint fails it.

## T-007-10 — Contract drift check

- **Goal:** CI fails when `packages/api-client` is stale relative to the DTOs.
- **Changes:** `apps/api/src/openapi/export.ts` (no DB, sorted keys), `@hitss/api-client` `generate` script + turbo task, `.prettierignore`/ESLint ignores for generated files, CI `contract` job.
- **Covers:** @AC-07.8.1, @AC-07.8.2, @AC-07.8.3, @AC-07.8.4
- **Done when:** export runs with no DB service; a fixture PR adding a DTO field without regeneration fails showing the diff; regenerated → green.

## T-007-11 — Supply chain

- **Goal:** audit gate with expiring allowlist; weekly grouped updates.
- **Changes:** `tools/ci/audit.mjs` + unit tests, `security/audit-allowlist.json` (empty), CI `audit` job, `.github/dependabot.yml` (npm, github-actions, docker; groups; `build(deps)` / `ci` / `build(infra)` prefixes).
- **Covers:** @AC-07.9.1, @AC-07.9.3
- **Done when:** audit tests cover the five Examples rows; Dependabot config validates; a Dependabot commit message passes commitlint.

## T-007-12 — Mutation testing workflow

- **Goal:** Stryker on domain, nightly + manual + `mutation` label; break at 80 %.
- **Changes:** `apps/api/stryker.config.mjs`, `test:mutation` script, `.github/workflows/mutation.yml` (incremental cache, HTML report artifact).
- **Covers:** @AC-07.6.6
- **Done when:** manual run reports a score ≥ 80 % on current domain; unlabelled PRs don't trigger it; lowering `break` above the score fails the run.

## T-007-13 — Optional mobile Metro service

- **Goal:** `make mobile` shows the Expo Go QR via tunnel.
- **Changes:** `apps/mobile/Dockerfile.dev`, compose `mobile` service (profile `mobile`, tty), runbook section on `EXPO_PUBLIC_API_URL` with LAN IP.
- **Covers:** @AC-07.5.1, @AC-07.5.2, @AC-07.5.3
- **Done when:** a phone on mobile data opens the app via the QR (evidence in PR); default `docker compose up` starts no `mobile` container.

## T-007-14 — Bruno collection and `.http` files

- **Goal:** runnable request examples, kept truthful by CI.
- **Changes:** `tools/bruno/teams-tasks/**` (environment `local`, sign-in script setting `token`, tests per request, self-cleaning), `tools/http/*.http` + `http-client.env.json`, parity script, Bruno CLI step in `compose-smoke`.
- **Covers:** @AC-07.4.2, @AC-07.4.3, @AC-07.4.4
- **Done when:** `bru run --env local` passes against a fresh stack in CI; the parity script finds every Bruno request in the `.http` files; demo data unchanged after the run.

## T-007-15 — README final

- **Goal:** the README answers every brief requirement and matches reality.
- **Changes:** root `README.md`: overview, quick start (Docker only; with/without make), demo credentials, scripts/aliases table, request examples (cURL from api-contracts), architecture decisions (links to ADRs), data model (link), testing (link to test strategy), observability (link), production readiness (link), contributing (conventions, branch protection), troubleshooting (link to runbook).
- **Covers:** @AC-07.3.3, @AC-07.4.1, @AC-07.10.4, @AC-06.8.3
- **Done when:** a reviewer follows the README on a clean machine with only Docker and reaches the seeded API and Swagger without deviation; markdown link check passes.
