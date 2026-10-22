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
| T-007-15 | README final: how to run, scripts, request examples, links                              | all above, T-006-08, T-007-16          | M    | `docs/007-readme-final`           |
| T-007-16 | README doc-check: required sections and relative links, in CI                           | T-007-03                               | S    | `ci/007-readme-doc-check`         |
| T-007-17 | Traceability `--require-tests`: every MUST AC of a done task has an automated test      | T-007-06                               | S    | `ci/007-require-tests`            |

## T-007-01 — Compose with PostgreSQL and `.env.example`

- **Status:** done
- **Goal:** `docker compose up postgres` gives a healthy PostgreSQL 17 with defaults only.
- **Changes:** `docker-compose.yml` (`postgres` service, volume, `pg_isready` healthcheck, `${VAR:-default}` everywhere), `.env.example` (all variables, comments), `.gitattributes` (`*.sh text eol=lf`), `.dockerignore`, `tools/ci/env-example.test.mjs` (parity check).
- **Covers:** @AC-07.1.4 (partially), @AC-07.1.5 (DB port)
- **Done when:** with no `.env`, `docker compose up -d --wait postgres` is healthy; `POSTGRES_PORT=5433` works; parity test passes.

## T-007-02 — Validated API configuration

- **Status:** done
- **Goal:** one typed config, validated at start-up with **class-validator** (decision X2), failing fast with the variable name; safe local defaults; an extension seam so spec 001 adds its variables and production rules without touching the validator.
- **Changes:** `apps/api/src/config/` (`env.schema.ts` — decorated `EnvironmentVariables` class; `env.validation.ts` — `validate()` = `plainToInstance` + `validateSync` + production rules, aggregating all violations into one error that names variables, never values; `production-rules.ts` — list of `(config) => Violation[]` rules applied only when `APP_ENV=production`; `app-config.ts` — typed `AppConfig`; `config.module.ts` — `ConfigModule.forRoot({ isGlobal: true, validate })`), ESLint `no-restricted-properties` for `process.env` outside `src/config/` and `src/instrumentation.ts`. Variables delivered here: `APP_ENV` (`local|test|production`, distinct from `NODE_ENV`), `PORT`, `DATABASE_URL`, `LOG_LEVEL`, `LOG_PRETTY`, `OTEL_*`, `RATE_LIMIT_MAX`, `SEED_ON_START`, `BETTER_AUTH_SECRET` (+ its production rule) — the **only** auth variable delivered here. `BETTER_AUTH_URL` and every other auth variable below are added by 001 (T-001-01) to this schema. `.env.example` sync (parity test).
- **Seam for 001 (rows and rules added there, listed in plan § Configuration validation):** `BETTER_AUTH_URL` (https in production), `CORS_ORIGINS` (no `*`, no `http://`, no `localhost` in production), `APP_SCHEME` (`!= exp` in production), `AUTH_RATE_LIMIT_ENABLED` (`false` rejected in production), `SEED_DEMO` (never `true` in production), `DOCS_ENABLED` (forced `false` in production), `RATE_LIMIT_IP_MAX`, `TRUSTED_PROXIES`. 007 provides the rule-list mechanism and a test helper `expectInvalid(env, 'VAR')` so each added rule is a one-line registration plus one unit test.
- **Covers:** @AC-07.1.4, @AC-06.5.5
- **Done when:** unit tests: each invalid value → error naming the variable and not echoing the value; several invalid variables → one error listing all; `APP_ENV=production` + the default secret → start refused while `APP_ENV=local` with `NODE_ENV=production` (the image) is accepted; defaults yield a valid config; registering an extra rule in a test requires no change to `validate()`.

## T-007-03 — CI skeleton

- **Status:** done
- **Goal:** every PR and push to main runs install (frozen lockfile, pnpm store cache, Turborepo cache), commitlint on the PR range, format check, lint, typecheck, unit tests, build; one aggregate `ci-success`.
- **Changes:** `.github/workflows/ci.yml`, `.github/actions/setup/action.yml`, `turbo.json` (cache dir, `arch`, `test:integration`, `generate` placeholders), concurrency group with cancel-in-progress for PRs, `permissions: contents: read`, actions pinned by SHA, job timeouts.
- **Toolchain pins (scaffold fix):** the Nest scaffold currently resolves `jest@^30` with `ts-jest@^29.2.5`; `ts-jest` supports Jest 30 only from **29.4.0**. Pin a compatible set in the root/`apps/api` manifests: `jest ~30.x`, `@types/jest ~30.x`, `ts-jest ~29.4.x` (peer range `jest ^29 || ^30`), and align `jest-environment-*`/`jest-junit` to the same Jest major; `jest-expo` in `apps/mobile` keeps its own Jest per its SDK (not shared). Add `.npmrc` `strict-peer-dependencies=true` for CI (`pnpm install --frozen-lockfile` then fails on a peer mismatch) and a `pnpm.overrides` entry only if a transitive duplicate remains. Evidence: `pnpm install` prints no peer warnings; `pnpm test` runs.
- **Covers:** @AC-07.6.1 (initial gates), @AC-07.6.2, @AC-07.6.3, @AC-07.6.4, @AC-07.6.7, @AC-07.9.2, @AC-07.10.1, @AC-07.10.2, @AC-07.10.3
- **Done when:** a green PR on the scaffold; no peer-dependency warning on a clean install; the existing husky hooks and PR template are verified (invalid local commit rejected, staged files formatted, template links task/ADRs and has the checklist — AC-07.10.2/10.3); a PR with commit `added stuff` fails `commitlint` and `ci-success`; a second push cancels the first run; a re-run with no changes shows Turborepo cache hits. Branch-protection recommendations shared with the repo owner.

## T-007-04 — API Dockerfile and compose `api` service

- **Status:** done
- **Goal:** `docker compose up` builds the API image (pruned, non-root), applies migrations in a one-shot `migrate` service, seeds (when enabled) and starts with instrumentation; healthy via `/api/v1/health/ready`.
- **Changes:** `apps/api/Dockerfile` (targets `migrator` and `runtime`), `apps/api/docker-entrypoint.sh`, `docker-migrate.sh`, `database-url.cjs`, `prune-cli.cjs`, compose `migrate` (one-shot) and `api` services (`depends_on: postgres service_healthy` and `migrate service_completed_successfully`, healthcheck, `init`, `stop_grace_period`, hardening), `prisma` stays a dev dependency (only the migrator carries the CLI), seed compiled to `dist/prisma/seed.js` (stub until T-007-07), `pnpm.onlyBuiltDependencies`.
- **Covers:** @AC-07.1.1, @AC-07.1.2, @AC-07.1.6, @AC-07.1.7
- **Done when:** fresh clone → `docker compose up -d --build --wait` returns with `api` healthy; `docker compose exec api id -u` ≠ 0; image has no `src/`, `test/`, `.env`, `.git`; unreachable DB → the `migrate` container exits non-zero and `api` never starts; image < 500 MB (base 244 MB + `@prisma/client` 71 MB).

## T-007-05 — Architecture rules

- **Status:** done
- **Goal:** the full overview §7 rule set (A1–A9, M1–M6 plus `mobile-not-to-api`) enforced by dependency-cruiser in API and mobile, with tests proving each rule fires and the real tree passes.
- **Changes:** `apps/api/.dependency-cruiser.cjs` (A1 `domain-is-pure` + `domain-no-third-party`, A2, A3, A4, A5 `contexts-isolated` for every layer with only `modules/<b>/contracts/` allowed, A6 `contracts-are-thin`, A7, A8, A9, `not-to-dev-dep`, `not-to-unresolvable`, `no-orphans` warn; `tsPreCompilationDeps: true`), `apps/mobile/.dependency-cruiser.cjs` (M1, M2, M3, M4 libraries, M5, M6, `mobile-not-to-api`), ESLint M4 block in `apps/mobile/eslint.config.mjs` (`no-restricted-imports` + `no-restricted-globals: ['fetch']`), `arch` scripts + turbo task, `apps/{api,mobile}/test/architecture/{rules.spec.ts,fixtures/**}`, CI `static` job runs `turbo run arch`. All paths are the overview §6.2/§6.3 paths (`modules/identity`, `modules/teams`, `modules/tasks`, `modules/health`, `src/config`, `src/shared/**`); the task is blocked until overview is amended for `modules/auth → modules/identity`.
- **Covers:** @AC-07.7.1, @AC-07.7.2, @AC-07.7.3, @AC-07.7.4, @AC-07.7.5, @AC-07.7.6, @AC-07.7.7, @AC-07.7.8, @AC-07.7.9
- **Done when:** meta-test passes for every Examples row (rule name, file and import asserted); every `forbidden[].name` has a fixture (the suite fails otherwise); the A5 layer matrix (domain/application/infrastructure/presentation → another module's non-contract file) fails and the `contracts/` edge passes; the real `src/` tree passes; `pnpm arch` locally = CI command.

## T-007-06 — Integration tests job, coverage gates and traceability check

- **Status:** done
- **Goal:** Testcontainers integration + supertest e2e in CI; coverage thresholds enforced; every `@must` AC has a test.
- **Changes:** CI `integration` job, `apps/api/jest.config.ts` + `jest.integration.config.ts` (`coverageThreshold` global 80 / domain 90), `jest-junit` reporters, artifact upload on failure; `tools/ci/traceability.mjs` (+ unit tests with fixture specs) in the `static` job. It parses `docs/specs/*/spec.md` (AC ids and priority), `*.feature` (`@AC-` tags), `tasks.md` (`Covers:` lines) and test names (AC ids in `describe`/`it` titles), **regenerates `docs/quality/traceability-matrix.md`** (AC → scenario → task → test), and fails when (a) a MUST AC has no scenario, (b) a MUST AC is in no task's `Covers:`, (c) a `@must` AC has no test once its task is done, or (d) the committed matrix differs from the regenerated one (`git diff --exit-code`; `pnpm traceability` rewrites it locally).
- **Covers:** @AC-07.6.1 (integration gate), @AC-07.6.5 (the traceability gate is part of the static gate)
- **Done when:** a PR lowering domain coverage under 90 % fails with the shortfall printed; integration suite green on `ubuntu-24.04`; removing the only test of a `@must` AC, deleting the scenario of a MUST AC, or dropping an AC from every `Covers:` line each fails the traceability check; a stale matrix fails it with the diff.

## T-007-07 — Deterministic, idempotent seed

- **Goal:** demo user + 3 teams + 10 tasks with fixed ids; re-seed restores seeded rows, keeps others; reset works.
- **Changes:** `apps/api/prisma/seed.ts` (orchestrator: gate, then calls `identity.seed.ts` from 001 → `teams.seed.ts` from 002 → tasks seed from 003; the demo user is created via `auth.api.signUpEmail` with the fixed `DEMO_USER_ID` set by `databaseHooks.user.create.before`, checked by id, never looked up by email alone), `apps/api/package.json` (`db:seed`, `db:reset`, `prisma.seed`), seed integration test. Team colors as in 002: Mobile `#7C3AED`, Backend `#0EA5E9`, Design `#F59E0B`.
- **Covers:** @AC-07.2.1, @AC-07.2.2, @AC-07.2.3, @AC-07.2.4, @AC-07.2.5, @AC-07.2.6, @AC-07.1.3
- **Done when:** integration test: seed ×2 → identical snapshot; rename "Mobile" + own task → re-seed restores "Mobile", keeps own task; reset → exactly 3/10; the demo user's id equals `DEMO_USER_ID` and sign-in works; `SEED_ON_START=false` → seed step not run; `SEED_DEMO=false` or `APP_ENV=production` → no user, team or task written and exit code 0. Also: move the `seed` alias from the “Not available yet” block of `make help` to a real `##` target in the Makefile, and add it to the CI `make -n` list and to `tools/ci/makefile.test.mjs`.

## T-007-08 — Root scripts and Makefile

- **Goal:** brief scripts `start`, `test`, `seed` and the Docker-only aliases.
- **Changes:** root `package.json` scripts (`start`, `stop`, `test`, `seed`, `db:reset`, `arch`, `api-client:generate`), `Makefile` (`up`, `down`, `logs`, `seed`, `reset`, `test`, `test-docker`, `observability`, `observability-down`, `mobile`, `smoke`, `load`, `help`).
- **Delivered now:** scripts `start`, `stop`, `test` (unit), `test:all` (unit + integration + e2e); Makefile `help`, `up`, `down`, `logs`, `reset`, `test`, `test-all`, `test-docker`, `smoke`. **Pending** (listed by `make help`, added with the task that creates what they run): `seed` and the `seed`/`db:reset` scripts (T-007-07), `observability`/`observability-down` (SigNoz profile, spec 006), `mobile` (T-007-13), `load` (k6), `api-client:generate` (T-007-10).
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
- **Done when:** a phone on mobile data opens the app via the QR (evidence in PR); default `docker compose up` starts no `mobile` container. Also: move the `mobile` alias from the “Not available yet” block of `make help` to a real `##` target in the Makefile, and add it to the CI `make -n` list and to `tools/ci/makefile.test.mjs`.

## T-007-14 — Bruno collection and `.http` files

- **Goal:** runnable request examples, kept truthful by CI.
- **Changes:** `tools/bruno/teams-tasks/**` (environment `local`, sign-in script setting `token`, tests per request, self-cleaning), `tools/http/*.http` + `http-client.env.json`, parity script, Bruno CLI step in `compose-smoke`.
- **Covers:** @AC-07.4.2, @AC-07.4.3, @AC-07.4.4
- **Done when:** `bru run --env local` passes against a fresh stack in CI; the parity script finds every Bruno request in the `.http` files; demo data unchanged after the run.

## T-007-15 — README final

- **Goal:** the README answers every brief requirement and matches reality.
- **Changes:** root `README.md` with the sections the doc-check (T-007-16) requires — "Architectural decisions" (database choice and that persistence was proposed and justified, entity/relationship modelling, backend layering, key patterns such as React Query vs Zustand), "Data model" (diagram or textual description, migrations, seeding, local reproducibility), "How to run" (backend and mobile, step by step, plus API contract summary with payload/envelope examples), "What I would do differently in production" (at least caching, logging, scalability, security): overview, quick start (Docker only; with/without make), demo credentials, scripts/aliases table, request examples (cURL from api-contracts), architecture decisions (links to ADRs), data model (link), testing (link to test strategy), observability (link), production readiness (link), contributing (conventions, branch protection), troubleshooting (link to runbook).
- **Covers:** @AC-07.3.3, @AC-07.4.1, @AC-07.4.5, @AC-07.4.6, @AC-07.4.7, @AC-07.4.8, @AC-07.10.4, @AC-06.8.3
- **Done when:** a reviewer follows the README on a clean machine with only Docker and reaches the seeded API and Swagger without deviation; markdown link check passes.

## T-007-16 — README doc-check

- **Status:** done
- **Goal:** CI fails when a required README section is missing or a relative link in it is broken.
- **Changes:** `tools/ci/doc-check.mjs` (+ unit tests with fixture READMEs): parses `README.md` headings and checks the required sections exist and are non-empty — "Architectural decisions", "Data model", "How to run" (with backend and mobile subsections), "What I would do differently in production" (must mention caching, logging, scalability, security) — via a `tools/ci/readme-required-sections.json` list; resolves every relative link and anchor in `README.md` and fails naming the file and link. Wired as `pnpm doc-check` and into the CI `static` job (same command locally and in CI). Until T-007-15 lands, the README skeleton (headings only) is committed so the check is green.
- **Covers:** @AC-07.4.9
- **Done when:** unit tests: a README without each required section fails naming it; a section missing one of the four production topics fails; a broken relative link fails naming the link; the committed README passes; a throwaway PR removing "Data model" turns `static` red.

## T-007-17 — Traceability `--require-tests`

- **Status:** done
- **Goal:** the strict form of the test ratchet: every `@must` AC covered by a **done** task has at least one automated test (T-007-06 only stops tests from being lost).
- **Changes:** a task records completion with a `- **Status:** done` line, added by the PR that completes it; `tools/ci/traceability.mjs --require-tests` (now part of `pnpm traceability:check`, hence of the `static` job) fails on a MUST AC whose covering tasks are **all** done and that has no automated test (a waiver in `tools/ci/traceability-waivers.json`, with a reason, downgrades it to a warning); unit tests with fixture specs.
- **Covers:** @AC-07.6.5
- **Done when:** unit tests: a done task whose MUST AC has no test fails naming the AC and the task; an open task does not; a waiver downgrades it to a warning; the current repo passes with the statuses set honestly.
