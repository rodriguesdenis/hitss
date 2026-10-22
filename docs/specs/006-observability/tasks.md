# 006 — Tasks

Order matters; each task is one PR. Sizes: **S** < 150 changed lines, **M** < 400 (excluding lockfile). T-006-03 (readiness) is a prerequisite of the compose healthcheck in [007](../007-ci-and-dx/tasks.md) (T-007-04).

| ID       | Task                                                    | Depends on                            | Size | Branch                      |
| -------- | ------------------------------------------------------- | ------------------------------------- | ---- | --------------------------- |
| T-006-01 | Bootstrap OpenTelemetry before Nest                     | T-007-02 (config validation baseline) | M    | `feat/006-otel-bootstrap`   |
| T-006-02 | Structured logging with trace correlation and redaction | T-006-01                              | M    | `feat/006-pino-logging`     |
| T-006-03 | Readiness probe (extends 001 liveness)                  | T-001-08, T-001-02 (Prisma module)    | S    | `feat/006-health-checks`    |
| T-006-04 | Use-case spans and error-envelope trace id              | T-006-01                              | S    | `feat/006-handler-spans`    |
| T-006-05 | RED metrics and task counters                           | T-006-01, 003 domain events           | M    | `feat/006-metrics`          |
| T-006-06 | SigNoz compose profile and dashboard                    | T-006-01, T-007-04                    | M    | `feat/006-signoz-profile`   |
| T-006-07 | k6 smoke and load scripts                               | T-007-04, 003 endpoints               | M    | `feat/006-k6-tests`         |
| T-006-08 | Operations docs final pass                              | T-006-01…07                           | S    | `docs/006-operations-final` |

## T-006-01 — Bootstrap OpenTelemetry before Nest

- **Status:** done
- **Goal:** traces and metrics exported over OTLP/HTTP, started before any instrumented module loads, never crashing the API.
- **Changes:** `apps/api/src/instrumentation.ts`; `TelemetryEnv` class-validator class in `src/config/telemetry.env.ts` (composed into the `ConfigModule` `validate()` and called directly by the bootstrap); `package.json` scripts `start`/`start:prod` use `node --import ./dist/instrumentation.js dist/main.js`; diag→logger bridge with 60 s de-dup; shutdown hook; `.env.example` OTEL variables; deps `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, OTLP HTTP exporters, `@prisma/instrumentation`.
- **Covers:** @AC-06.2.1 (HTTP + DB spans present), @AC-06.2.2, @AC-06.2.5 (pg/http hygiene), @AC-06.2.6, @AC-06.5.1, @AC-06.5.2, @AC-06.5.3, @AC-06.5.4, @AC-06.5.5 (telemetry settings)
- **Done when:** integration test with `InMemorySpanExporter` sees an HTTP server span with a DB child; with endpoint `http://127.0.0.1:1` the app is ready and requests are 2xx; `OTEL_SDK_DISABLED=true` exports nothing; SIGTERM test exits 0; invalid `OTEL_EXPORTER_OTLP_ENDPOINT` fails start with the variable name.

## T-006-02 — Structured logging with trace correlation and redaction

- **Status:** done
- **Goal:** one JSON completion line per request with `reqId`, `traceId`, `spanId`, `userId`; no credentials or PII ever logged.
- **Changes:** `src/shared/observability/` (`observability.module.ts`, `logging/{logger.config,redact-paths,request-id,sanitize-url,pino-bridge,prisma-log}.ts`, trace mixin); Better Auth `logger` and Prisma `log` events wired to the bridges, `main.ts` `app.useLogger(app.get(Logger))`, `bufferLogs: true`; `LOG_LEVEL`, `LOG_PRETTY` in `TelemetryEnv`; `X-Request-Id` response header.
- **Covers:** @AC-06.2.3, @AC-06.3.1, @AC-06.3.2, @AC-06.3.3, @AC-06.3.4 (log side), @AC-06.3.5, @AC-06.3.6, @AC-06.3.7, @AC-06.3.8, @AC-06.1.5 (log side)
- **Done when:** a unit test with **nested objects** proves every `REDACT_PATHS` entry (authorization, cookie, `set-cookie`, `set-auth-token`, nested `password`/`newPassword`/`currentPassword`/`token`); `/api/auth/*` query strings are stripped; Better Auth warnings arrive as pino `warn`; the Prisma forwarder never emits `params`; log-capture integration tests pass for sign-up/sign-in; request id outline passes; grep of captured logs for `Demo@1234` and `demo@teams-tasks.dev` is empty.

## T-006-03 — Liveness and readiness probes

- **Status:** done
- **Goal:** add `/api/v1/health/ready` (DB ping, 1.5 s timeout), public and unthrottled. `/api/v1/health/live` already exists from T-001-08 and is **not recreated**; this task only verifies it and extends the module.
- **Changes:** `src/modules/health/` (add the readiness route to the existing controller, Terminus `PrismaHealthIndicator`; same `@AllowAnonymous() @SkipThrottle() @RawResponse()` as liveness), probes excluded from request logs and traces (`isProbe` helper in `src/shared/observability/`, shared with T-006-01/02).
- **Covers:** @AC-06.1.1, @AC-06.1.2, @AC-06.1.3, @AC-06.1.4, @AC-06.1.5
- **Done when:** Testcontainers test stops the DB → `/ready` 503 in < 2 s and `/live` 200; restart → `/ready` 200; 200 calls → no 429.

## T-006-04 — Use-case spans and error-envelope trace id

- **Status:** done
- **Goal:** the "handler" span between HTTP and DB; `error.traceId` in every error envelope.
- **Changes:** `src/shared/observability/tracing/traced-handler.ts` (or CQRS bus wrapper) applied to all command/query handlers; `GlobalExceptionFilter` (`src/shared/presentation/filters/`) reads the active trace id; unexpected errors logged once with stack.
- **Covers:** @AC-06.2.1 (handler span), @AC-06.2.4, @AC-06.3.4
- **Done when:** span-tree assertion `HTTP → ListTasksHandler → DB` passes; 400 and forced-500 responses carry a `traceId` equal to the trace's id; 500 body has no stack.

## T-006-05 — RED metrics and task counters

- **Status:** done
- **Goal:** `http.server.request.duration` with route template; `tasks_created_total`, `tasks_completed_total`, `tasks_deleted_total` from domain events.
- **Changes:** `TaskMetrics` port (`modules/tasks/application/ports/`), `record-task-metrics.handler.ts` (`modules/tasks/application/events/`), `otel-task-metrics.adapter.ts` (`modules/tasks/infrastructure/adapters/`), binding in `tasks.module.ts`; metric views if needed to drop high-cardinality attributes. Only the three task counters exist (no `teams_*` metrics).
- **Covers:** @AC-06.4.1, @AC-06.4.2, @AC-06.4.3, @AC-06.4.4, @AC-06.4.5
- **Done when:** unit tests with a fake counter cover the status outline; integration with `InMemoryMetricExporter` covers idempotent replay and validation rejection; attribute scan finds no ids/emails/URLs.

## T-006-06 — SigNoz compose profile and dashboard

- **Goal:** `docker compose --profile observability up -d` (or `make observability`) runs SigNoz; API exports to it with no edits.
- **Changes:** `infra/signoz/docker-compose.signoz.yml` (pinned images, profile `observability`), collector config, `include:` in root `docker-compose.yml`, `infra/signoz/dashboards/teams-tasks-api.json`, Makefile `observability` / `observability-down` targets.
- **Covers:** @AC-06.6.1, @AC-06.6.2, @AC-06.6.3, @AC-06.6.4
- **Done when:** on a clean machine the UI opens at `http://localhost:8080`, a request's trace is found by trace id with linked logs, the dashboard imports and shows RED + counters; `docker compose up` (no profile) starts no SigNoz container. Evidence (screenshot) in the PR. Also: move the `observability` and `observability-down` alias from the “Not available yet” block of `make help` to a real `##` target in the Makefile, and add it to the CI `make -n` list and to `tools/ci/makefile.test.mjs`.

## T-006-07 — k6 smoke and load scripts

- **Goal:** repeatable performance verification with thresholds, Docker only.
- **Changes:** `tools/k6/{smoke.js,load.js,lib/*.js,README.md}`, compose service `k6` (profile `load`), Makefile `smoke` / `load` targets, `make load` raises `RATE_LIMIT_MAX` and `RATE_LIMIT_IP_MAX` for the run (override documented in the runbook).
- **Covers:** @AC-06.7.1, @AC-06.7.2, @AC-06.7.3, @AC-06.7.4
- **Done when:** `make smoke` passes on the seeded stack and leaves 3 teams / 10 tasks; `make load` (with both rate limits raised) reports list p95 < 100 ms and error rate < 1 % on a dev laptop (output in PR); a deliberately low threshold makes it exit non-zero. Smoke is wired into the CI `compose-smoke` job (T-007-09). Also: move the `load` alias from the “Not available yet” block of `make help` to a real `##` target in the Makefile, and add it to the CI `make -n` list and to `tools/ci/makefile.test.mjs`.

## T-006-08 — Operations docs final pass

- **Goal:** docs match reality (ports, commands, signal names, screenshots).
- **Changes:** `docs/operations/observability.md`, `runbook.md`, `production-readiness.md`; README link (via T-007-15).
- **Covers:** @AC-06.8.1, @AC-06.8.2, @AC-06.8.3
- **Done when:** every command in the docs was executed on a clean clone; markdown link check passes.
