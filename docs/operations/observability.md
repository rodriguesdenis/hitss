# Observability

How the API is instrumented, how to see the signals locally, and what to chart and alert on. Design and tasks: [spec 006](../specs/006-observability/spec.md) · [plan](../specs/006-observability/plan.md) · [ADR-0013](../architecture/adr/0013-opentelemetry-and-signoz.md).

> Observability is **optional at runtime**. `docker compose up` runs without any telemetry backend; the API silently drops telemetry it cannot export. Turn telemetry off completely with `OTEL_SDK_DISABLED=true`.

## Signals at a glance

| Signal      | Source                                                                                                                                                                   | Where to read it locally                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Traces      | OpenTelemetry Node SDK (`src/instrumentation.ts`) — auto-instrumentation `http`, `express`, `@nestjs/core`, `pg` + `@prisma/instrumentation` + one span per CQRS handler | SigNoz → Traces                                       |
| Metrics     | OTel SDK → OTLP every 15 s                                                                                                                                               | SigNoz → Dashboards / Metrics explorer                |
| Logs        | `nestjs-pino` JSON on stdout; also sent over OTLP (pino instrumentation)                                                                                                 | `docker compose logs -f api` · SigNoz → Logs          |
| Health      | `@nestjs/terminus`                                                                                                                                                       | `GET /api/v1/health/live`, `GET /api/v1/health/ready` |
| Correlation | `X-Request-Id` response header, `error.traceId` in error envelopes                                                                                                       | response headers / app error screen                   |

Resource attributes on every signal: `service.name=teams-tasks-api`, `service.version=<package version>`, `deployment.environment.name=<APP_ENV>`.

## Traces

Every request is **one trace**:

```text
GET /api/v1/tasks                         (http server span — route template, status code)
 └─ request handler / TasksController.list (nestjs-core / express spans)
     └─ ListTasksHandler                   (use-case span, one per command/query handler)
         ├─ prisma:client:operation Task.findMany
         │   └─ prisma:engine:db_query  /  pg.query SELECT …   (statement, no parameter values)
         └─ prisma:client:operation Task.count
```

- Incoming W3C `traceparent` is honored (a client trace continues into the API).
- Probes (`/api/v1/health/*`) are not traced.
- Never on spans: headers, bodies, query strings, emails, DB parameter values ([threat model I-03](../security/threat-model.md#information-disclosure)).

## Metrics

| Metric                                           | Type              | Unit | Attributes                                                       | Use                                                                                                    |
| ------------------------------------------------ | ----------------- | ---- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `http.server.request.duration`                   | histogram         | s    | `http.request.method`, `http.route`, `http.response.status_code` | **RED**: Rate = count/s, Errors = count with status ≥ 500 (and 4xx separately), Duration = p50/p95/p99 |
| `tasks_created_total`                            | counter           | 1    | —                                                                | business throughput (from `TaskCreated`)                                                               |
| `tasks_completed_total`                          | counter           | 1    | —                                                                | completions (from `TaskStatusChanged` with `to = DONE`)                                                |
| `tasks_deleted_total`                            | counter           | 1    | —                                                                | deletions (from `TaskDeleted`)                                                                         |
| `db.client.connection.*` (pg instr., if enabled) | gauges/histograms |      | pool name                                                        | connection pool saturation                                                                             |
| Node runtime (`nodejs.eventloop.delay`, heap)    | gauges            |      |                                                                  | saturation (optional, via runtime instrumentation)                                                     |

Rules: attributes are low-cardinality only; never user ids, emails, resource ids, search terms or raw URLs.

## Logs

One JSON object per line. Example completion entry:

```json
{
  "level": 30,
  "time": 1792501200000,
  "msg": "request completed",
  "reqId": "3f0c8a2e-6a7b-4c1d-9e8f-0a1b2c3d4e5f",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "userId": "usr_8d1…",
  "req": { "method": "GET", "route": "/api/v1/tasks" },
  "res": { "statusCode": 200 },
  "responseTime": 12
}
```

- Levels: `LOG_LEVEL` (`info` default). Human-readable output: `LOG_PRETTY=true`.
- Redacted: `authorization`, `cookie`, `set-cookie`, `set-auth-token`, `*.password`, `*.token`, `*.secret`, `*.email` → `[REDACTED]`. Bodies are never logged.
- Unexpected errors: one `level:50` entry with `err.type`, `err.message`, `err.stack` and the `traceId` returned to the client.
- Find all logs of a request: `docker compose logs api | grep <traceId>` (or click "Logs" on the trace in SigNoz).

## Health

| Endpoint                   | Meaning                                                      | Used by                                          |
| -------------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| `GET /api/v1/health/live`  | Process up; no dependency check                              | liveness (orchestrator restart)                  |
| `GET /api/v1/health/ready` | DB reachable (`SELECT 1`, 1.5 s timeout) → `200`, else `503` | compose healthcheck, `depends_on`, load balancer |

Public, unthrottled, not logged/traced. The telemetry backend is never a readiness dependency.

## Running SigNoz locally

Requirements: Docker with **≈ 4 GB free RAM** (ClickHouse is the heavy part) and ~2 GB disk.

```bash
make observability                       # = docker compose --profile observability up -d --build --wait
# UI:        http://localhost:8080        (first start: create the local admin account when prompted)
# Collector: OTLP gRPC :4317 · OTLP HTTP :4318 (the API exports to http://signoz-otel-collector:4318)
make observability-down                  # stops SigNoz and deletes its volumes
```

The API needs no change: its default `OTEL_EXPORTER_OTLP_ENDPOINT` already points at the collector service name; before the profile is up, exports just fail quietly.

### Find a trace

1. Generate traffic: open the app, or `make smoke`, or run a request from `tools/bruno/` / the README cURL examples.
2. Copy an id: the `traceId` of an error envelope, or the `traceId` of a log line (`docker compose logs api | tail`). `X-Request-Id` is searchable as the log field `reqId`.
3. SigNoz → **Traces** → filter `serviceName = teams-tasks-api`, or paste the trace id in the search box (`traceID = …`).
4. Open the trace: flame graph shows `GET /api/v1/tasks → ListTasksHandler → prisma/pg` spans with durations; the **Logs** tab shows the correlated log lines.
5. From a slow span, check `db.statement` to identify the query; compare with indexes in [data model](../architecture/data-model.md#indexes-and-why).

### Find errors

SigNoz → Traces → filter `hasError = true` or `httpStatusCode >= 500`; or Logs → `severity_text = ERROR`, then jump to the trace.

## Dashboards to create

Exported JSON in `infra/signoz/dashboards/teams-tasks-api.json` (import: Dashboards → New → Import JSON).

| Panel                              | Query (conceptual)                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| Request rate by route              | `sum(rate(http.server.request.duration_count)) by http.route`                  |
| Error rate (5xx %)                 | `5xx count / total count` by route                                             |
| 4xx by status                      | `count by http.response.status_code` where 400–499 (watch 401/404/409/412/429) |
| Latency p50/p95/p99                | histogram quantiles by route; highlight `GET /api/v1/tasks` vs 100 ms budget   |
| Tasks created / completed per hour | `increase(tasks_created_total[1h])`, `increase(tasks_completed_total[1h])`     |
| DB time share                      | sum of DB span durations / request duration (trace-derived)                    |
| Top slow traces                    | trace list sorted by duration, `GET /api/v1/tasks`                             |
| Readiness                          | external probe (production) or `up` derived from request rate                  |

## Alerts to define (documented, not provisioned locally)

| Alert                 | Condition                                                       | Severity | First action                                               |
| --------------------- | --------------------------------------------------------------- | -------- | ---------------------------------------------------------- |
| API error rate high   | 5xx > 2 % for 5 min (≥ 50 req)                                  | page     | Runbook → logs by `traceId` of failing requests            |
| Latency SLO burn      | task list p95 > 100 ms for 10 min / burn rate > 14× (1 h)       | page     | Check DB span share, slow queries, pool saturation         |
| Readiness failing     | `/ready` non-200 for 2 min on any instance                      | page     | DB reachability, credentials, connection limit             |
| Throttling spike      | 429 > 5 % of requests for 10 min                                | ticket   | Abuse vs. a misbehaving client (offline queue retry storm) |
| Auth failures spike   | 401 on `/api/auth/sign-in` > 10× baseline                       | ticket   | Credential stuffing → WAF/IP blocks                        |
| Concurrency conflicts | 412 rate > 5 %                                                  | ticket   | Offline sync conflicts — check client version              |
| No telemetry          | no spans from `teams-tasks-api` for 10 min while traffic exists | ticket   | Collector/exporter health                                  |

SLO proposals and error budgets are in [production readiness](production-readiness.md#reliability).

## Load and smoke tests

`tools/k6/` — see [006 plan § k6](../specs/006-observability/plan.md#k6).

```bash
make smoke    # all endpoints once; fails on any failed check
make load     # 20 VUs, 2 min; fails if task list p95 >= 100 ms or error rate >= 1 %
```

Run `make load` with SigNoz up to see the latency panels move; compare p95 there with k6's summary.

## Configuration reference

| Variable                      | Default                             | Effect                       |
| ----------------------------- | ----------------------------------- | ---------------------------- |
| `OTEL_SDK_DISABLED`           | `false`                             | `true` → no telemetry at all |
| `OTEL_SERVICE_NAME`           | `teams-tasks-api`                   | service name                 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://signoz-otel-collector:4318` | collector                    |
| `OTEL_TRACES_SAMPLER`         | `parentbased_always_on`             | sampling                     |
| `LOG_LEVEL`                   | `info`                              | log threshold                |
| `LOG_PRETTY`                  | `false`                             | human-readable logs          |
