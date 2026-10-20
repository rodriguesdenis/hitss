# ADR-0013 — OpenTelemetry + SigNoz

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, observability-sre

## Context

We want production-grade observability — distributed traces, RED metrics, structured logs correlated by trace id — as a senior-level signal (COULD). Constitution §VII.2 requires it to be **optional at runtime**: the API must work, and `docker compose up` must stay light, when no collector is running. Evaluators should be able to see a trace of a request in a UI with one extra command.

## Decision drivers

- Vendor-neutral instrumentation (swap backends without code changes).
- Automatic spans for HTTP, Express/Nest and Prisma; minimal manual code.
- Logs, traces and metrics in **one** UI, correlated by `trace_id`.
- Self-hosted, free, runs in Docker Compose.
- Zero impact when disabled.

## Considered options

### Instrumentation

- **OpenTelemetry Node SDK (chosen):** open standard; `@opentelemetry/auto-instrumentations-node` (HTTP, Express, pino), `@opentelemetry/instrumentation-nestjs-core`, `@prisma/instrumentation`; OTLP exporters. **−** SDK must load before any other import.
- **Vendor agents (dd-trace, newrelic):** turnkey, **−** proprietary, need SaaS accounts and API keys.

### Backend

| Option                                                    | Pros                                                                                            | Cons                                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **SigNoz** (chosen)                                       | OTel-native; traces, metrics, logs and dashboards in one UI; single Compose stack; open source. | Heavy: ClickHouse + collector + query service (~4 GB RAM).                                              |
| **Grafana LGTM** (Loki, Grafana, Tempo, Mimir/Prometheus) | Industry standard, flexible, `grafana/otel-lgtm` all-in-one image for dev.                      | Several query languages (LogQL, TraceQL, PromQL); correlation needs datasource wiring; more to explain. |
| **Jaeger + Prometheus**                                   | Lightweight, well known.                                                                        | Two UIs, no logs; correlation is manual.                                                                |
| **Datadog / New Relic** (SaaS)                            | Best-in-class UX, no ops.                                                                       | Accounts, keys and internet required; cost; breaks offline evaluation.                                  |

## Decision outcome

- **`src/instrumentation.ts`** starts the `NodeSDK` and is loaded first (`node --import ./dist/instrumentation.js dist/main.js`). Resource attributes: `service.name=teams-tasks-api`, `service.version`, `deployment.environment`.
- **Enabled only when** `OTEL_EXPORTER_OTLP_ENDPOINT` is set (validated by `@nestjs/config`); otherwise the SDK is not started and nothing is exported. `OTEL_SDK_DISABLED=true` also honored.
- **Traces:** auto-instrumentation for HTTP/Express/Nest, `@prisma/instrumentation` for queries; manual spans only around use cases (`command.ChangeTaskStatus`) with attributes `owner.id` (hashed), `task.id`, `result`.
- **Metrics** via the OTel Metrics API (no Prometheus client): HTTP server duration histograms (auto), business counters `tasks_created_total`, `tasks_completed_total`, `teams_deleted_total` incremented by `EventBus` handlers, DB pool gauges.
- **Logs:** `nestjs-pino` JSON logs to stdout always; `@opentelemetry/instrumentation-pino` injects `trace_id`/`span_id` into each line and, when the exporter is enabled, forwards logs over OTLP. Redaction of `authorization`, `cookie`, `set-cookie`, `set-auth-token` and auth request bodies.
- **Propagation:** W3C `traceparent` honored; `traceId` returned in every error envelope ([ADR-0005](0005-rest-openapi-and-response-envelope.md)); `X-Request-Id` on every response.
- **Runtime:** SigNoz runs under `docker compose --profile observability up` (`make obs-up`), with the API's `OTEL_EXPORTER_OTLP_ENDPOINT` pointing at the SigNoz collector. The default profile starts only postgres + api ([ADR-0018](0018-docker-compose-one-command-run.md)).
- **Health:** `@nestjs/terminus` `GET /api/v1/health/live` and `/ready` (Prisma ping) — independent of telemetry.

## Consequences

**Positive**

- One click from a slow request in the trace list to the exact SQL statement and its log lines.
- Backend is replaceable (Grafana, Honeycomb, Datadog OTLP intake) by changing an env var.
- Default run stays light; the API behaves identically without a collector.

**Negative**

- SigNoz needs ~4 GB RAM and a few minutes to start; documented, and hence opt-in.
- Instrumentation load order is a common pitfall; covered by a smoke test asserting a span exists when the exporter is set (in-memory exporter in tests).

**Neutral**

- Mobile app telemetry (RUM) is out of scope; the app propagates `traceparent` only if added later.

## Links

- [Spec 006 — Observability](../../specs/006-observability/spec.md)
- OpenTelemetry JS: https://opentelemetry.io/docs/languages/js/ · SigNoz: https://signoz.io/docs/
