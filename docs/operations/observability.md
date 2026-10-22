# Observability

What the API logs and traces, how to read them locally, and what to watch in production. The scope is deliberately small ([ADR-0020](../architecture/adr/0020-simplify-architecture-for-the-hiring-test.md), spec [008](../specs/008-simplification/spec.md)): JSON logs always, traces only when you ask for them.

> Telemetry is **optional at runtime**. `docker compose up` runs without any collector and exports nothing. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to export traces over OTLP/HTTP; `OTEL_SDK_DISABLED=true` turns the SDK off even then. Logs are unaffected either way.

## Signals at a glance

| Signal      | Source                                                                                                                              | Where to read it locally                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Logs        | `nestjs-pino`, one JSON object per line on stdout; there is no OTLP log pipeline                                                    | `docker compose logs -f api`                          |
| Traces      | OpenTelemetry Node SDK (`src/instrumentation.ts`), auto-instrumentations, exported over OTLP/HTTP **only when the endpoint is set** | any OTLP/HTTP collector or tracing UI you point it at |
| Metrics     | none exported by the API                                                                                                            | —                                                     |
| Health      | `GET /api/v1/health/live` (process) and `/ready` (database)                                                                         | `curl` / `docker compose ps`                          |
| Correlation | `X-Request-Id` response header, `reqId` and `traceId` in every log line, `error.traceId` in error envelopes                         | response headers, logs                                |

## Logs

One JSON object per line. Example completion entry:

```json
{
  "level": 30,
  "time": 1792501200000,
  "msg": "request completed",
  "reqId": "3f0c8a2e-6a7b-4c1d-9e8f-0a1b2c3d4e5f",
  "traceId": "3f0c8a2e-6a7b-4c1d-9e8f-0a1b2c3d4e5f",
  "userId": "usr_8d1…",
  "req": { "method": "GET", "url": "/api/v1/tasks" },
  "route": "/api/v1/tasks",
  "res": { "statusCode": 200 },
  "responseTime": 12
}
```

- `reqId` is the `X-Request-Id` of the request (a well-formed client value is echoed, otherwise one is generated).
- `traceId` is the OpenTelemetry trace id when telemetry is on (with a `spanId` next to it); otherwise it is the request id, the same fallback the error envelope uses. Either way one id finds all lines of a request: `docker compose logs api | grep <traceId>`.
- `route` is the route template (`/api/v1/tasks/:id`), so ids and search terms stay out of the aggregate; `req.url` is the path without its query string.
- Health probes (`/api/v1/health/*`) are not logged.
- Levels: `LOG_LEVEL` (`info` default; `debug` and `trace` are refused when `APP_ENV=production`). Human-readable output: `LOG_PRETTY=true` (needs the dev-only `pino-pretty`; the production image falls back to JSON with one warning).
- Redacted (`[REDACTED]`): credential headers (`authorization`, `cookie`, `set-cookie`, `set-auth-token`) and fields named `password`, `newPassword`, `currentPassword`, `token`, `accessToken`, `refreshToken`, `idToken`, `sessionToken`, `apiKey`, `secret`, `email`, `connectionString`, `databaseUrl` at depth 0 to 3. Request and response bodies are never logged.
- Better Auth's logger is bridged into pino (messages sanitized: URL query strings stripped, emails masked); Prisma logs warn/error events and, at `debug`, query events **without parameters**.
- Unexpected errors: one `level:50` entry with the error class and code only (driver messages can carry row values) and the `traceId` that the client also receives. Find them with `docker compose logs api | grep '"level":50'`.

## Traces (when enabled)

```text
GET /api/v1/tasks                          (http server span: route template, status code)
 └─ request handler / TasksController.list (express and nestjs-core spans)
     └─ pg-pool.connect, pg.query SELECT …  (the pg driver behind Prisma)
```

- An incoming W3C `traceparent` is honored: a client trace continues into the API.
- Health probes are not traced.
- The resource carries only `service.name` (`OTEL_SERVICE_NAME`, default `teams-tasks-api`): no process command line, user or host id.

**Treat exported spans as sensitive.** The API does not scrub them. When the endpoint is set they can contain the full request URL **including its query string** (search terms), `exception` events with the **error message and stack**, `client.address` and `user_agent.original`, and the SQL text of `pg` spans (statement text, no bound parameter values). Send them only to a collector you control, strip or drop those attributes there (an `attributes`/`transform` processor), and keep the endpoint `https` outside your machine: `APP_ENV=production` refuses a plain `http` endpoint and the per-signal `OTEL_EXPORTER_OTLP_{TRACES,METRICS,LOGS}_ENDPOINT` variables, which would bypass that rule.

### Look at a trace locally

Any OTLP/HTTP receiver works. For example, with a Jaeger all-in-one container (an example, not part of this repository's tests):

```bash
docker run --rm -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one
# API on the host: OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 in .env (from a container use an address it can reach)
# UI: http://localhost:16686  → service teams-tasks-api → paste a traceId from the logs
```

The repository's own check of this path is the compose smoke (`tools/ci/compose-smoke.sh`): it runs a tiny OTLP sink, asserts that **no** trace arrives when the endpoint is unset (even with a per-signal endpoint pointing at the sink) and that a trace for `teams-tasks-api` arrives when it is set.

## Health

| Endpoint                   | Meaning                                                                                                                                                                           | Used by                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `GET /api/v1/health/live`  | Process up; no dependency check                                                                                                                                                   | liveness                                         |
| `GET /api/v1/health/ready` | Database reachable (`SELECT 1`, 1.5 s bound; one attempt outstanding, pg connect 2 s / query 5 s) → `200 {"status":"ready","checks":{"database":"up"}}`, else `503` with `"down"` | compose healthcheck, `depends_on`, load balancer |

Public, unthrottled, not logged or traced. The telemetry backend is never a readiness dependency.

## What to watch in production

Not provisioned here; the API exports no metrics, so derive these from request logs (`res.statusCode`, `responseTime`, `route`) or from the load balancer:

| Signal        | Condition                                       | First action                                    |
| ------------- | ----------------------------------------------- | ----------------------------------------------- |
| 5xx rate      | > 2 % for 5 min                                 | logs by the `traceId` of failing requests       |
| Latency       | task list p95 above the budget (100 ms locally) | slow queries, pool saturation, indexes          |
| Readiness     | `/ready` non-200 for 2 min on any instance      | database reachability, credentials, connections |
| Throttling    | 429 > 5 % of requests                           | abuse vs. a misbehaving client                  |
| Auth failures | 401 on `/api/auth/sign-in` far above baseline   | credential stuffing: WAF / IP blocks            |

SLO proposals are in [production readiness](production-readiness.md#reliability).

## Configuration reference

| Variable                      | Default           | Effect                                                                                      |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset             | unset: nothing is exported. Set: traces go to this OTLP/HTTP endpoint (https in production) |
| `OTEL_SDK_DISABLED`           | `false`           | `true` → no telemetry even when the endpoint is set                                         |
| `OTEL_SERVICE_NAME`           | `teams-tasks-api` | service name on exported traces                                                             |
| `LOG_LEVEL`                   | `info`            | log threshold                                                                               |
| `LOG_PRETTY`                  | `false`           | human-readable logs (refused in production)                                                 |

Validated at start by a class-validator env class (`src/config/telemetry.env.ts`); an invalid value fails the start naming the variable (never its value). A collector that is down never affects requests: the API starts and answers normally.
