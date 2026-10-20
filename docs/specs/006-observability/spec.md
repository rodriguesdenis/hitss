# 006 — Observability & Operations

- **Epic:** [EP-06](../../product/epics/EP-06-observability-and-operations.md) · **Status:** Draft · **Priority:** COULD (US-06.8 MUST)

## Problem

When something is slow or failing, an operator needs to answer three questions quickly: _is the service up and able to serve?_, _what happened to this specific request?_, _is this a trend?_. Without built-in signals the only answer is "add logging and redeploy". At the same time, this is a hiring test run on a laptop: requiring a heavy telemetry stack just to start the API would hurt the evaluator's experience.

## Goals / Non-goals

**Goals**

- Liveness and readiness probes that tell "process up" apart from "able to serve".
- Every request followable end to end as one trace, with logs and errors carrying the same correlation id.
- Rate / errors / duration per route and business counters (tasks created, tasks completed).
- No credential or personal data ever written to logs, traces or metrics.
- Telemetry is **optional at runtime**: the API behaves identically with or without a telemetry backend.
- A local telemetry backend available behind one opt-in command.
- Repeatable smoke and load tests with explicit pass/fail thresholds.
- A written production-readiness plan (brief §5).

**Non-goals**

- Alert delivery to people (pager/chat), on-call process.
- Mobile app crash reporting or real-user monitoring.
- Long-term telemetry retention, hosted backends, cost management.

## User stories

### US-06.1 — Health probes (`COULD`, required by Constitution VII.1)

As an operator, I want liveness and readiness probes, so that traffic and dependent services only reach an instance that can serve.

**Acceptance criteria**

- **AC-06.1.1** Given the service process is running, when liveness is requested without credentials, then it answers "up" without consulting any dependency.
- **AC-06.1.2** Given the database is reachable, when readiness is requested without credentials, then it answers "ready" and lists the database check as up.
- **AC-06.1.3** Given the database is unreachable, when readiness is requested, then it answers "service unavailable" within 2 seconds and names the failing check, while liveness still answers "up".
- **AC-06.1.4** Given the database becomes reachable again, when readiness is requested, then it answers "ready" without a restart.
- **AC-06.1.5** Probe requests are never rate-limited, never require authentication and are not recorded as request logs or traces at the default log level.

### US-06.2 — End-to-end request tracing (`COULD`)

As an operator, I want every request traced from entry through the use case to the database, so that I can see where time is spent and where it failed.

**Acceptance criteria**

- **AC-06.2.1** Given the telemetry backend is running, when an authenticated user lists tasks, then exactly one trace is recorded containing an entry span named after the method and route template, a use-case span as its descendant, and at least one database span as a descendant of the use-case span.
- **AC-06.2.2** Given a caller sends standard trace context, when the request is handled, then the recorded trace continues the caller's trace (same trace id).
- **AC-06.2.3** Every response carries a request id; given the caller sent a well-formed request id, then the same value is returned; given none or a malformed one, then a new one is generated.
- **AC-06.2.4** Given a request fails with an error envelope, then the envelope contains the trace id of that request's trace.
- **AC-06.2.5** Spans never contain passwords, session tokens, authorization or cookie values, request or response bodies, email addresses, or database parameter values.
- **AC-06.2.6** All telemetry identifies the service as `teams-tasks-api`, with its version and deployment environment.

### US-06.3 — Structured, correlated, redacted logs (`COULD`)

As an operator, I want machine-readable logs correlated with traces and free of secrets, so that I can investigate safely.

**Acceptance criteria**

- **AC-06.3.1** Given any non-probe request, when it completes, then exactly one structured completion entry is written with method, route template, status code, duration, request id, trace id and span id.
- **AC-06.3.2** Given a log entry written while handling a request, then it carries the same request id and trace id as the request's completion entry.
- **AC-06.3.3** Given a request carrying any sensitive value — password, authorization header, cookie, session token in request or response headers — when it is logged, then the value never appears in the logs (it is replaced by a redaction marker or omitted).
- **AC-06.3.4** Given an unexpected error, then one error-level entry with the error type and stack trace is logged, and the response contains only the generic message and the trace id.
- **AC-06.3.5** The minimum log level is configurable (default: info); a human-readable format can be enabled for local development; the default output is one machine-readable object per line on standard output.
- **AC-06.3.6** Logs may carry the opaque user id of the authenticated user, but never the email address or name.

### US-06.4 — RED metrics and business counters (`COULD`)

As an operator, I want request rate, errors and duration per route plus business counters, so that I can watch trends and usage.

**Acceptance criteria**

- **AC-06.4.1** Given requests are served, then their duration is recorded as a distribution dimensioned by method, route template and status code, from which rate, error rate and latency percentiles can be derived.
- **AC-06.4.2** Given a task is created successfully, then the "tasks created" counter increases by exactly 1; given the same creation is replayed with the same idempotency key, then it does not increase again; given creation is rejected by validation, then it does not increase.
- **AC-06.4.3** Given a task's status changes to Done, then the "tasks completed" counter increases by exactly 1; given the status is set to the value it already has, or changes between non-Done statuses, then it does not increase.
- **AC-06.4.4** Metric dimensions never include user ids, emails, resource ids, search terms or raw URLs.
- **AC-06.4.5** Given a task is deleted, then the "tasks deleted" counter increases by exactly 1.

### US-06.5 — Telemetry is optional at runtime (`COULD`, Constitution VII.2–3)

As an evaluator, I want the API to work normally when no telemetry backend is running, so that observability never blocks running the project.

**Acceptance criteria**

- **AC-06.5.1** Given no telemetry backend is reachable, when the API starts, then it becomes ready within its normal start-up time and serves requests with normal results.
- **AC-06.5.2** Given the telemetry backend stops while the API is running, then requests keep succeeding with no added latency attributable to telemetry, and at most one telemetry-export warning is logged per minute.
- **AC-06.5.3** Given telemetry is disabled by configuration, then no telemetry is produced or exported, and logs are still written (without span ids).
- **AC-06.5.4** Given the API receives a termination signal, then it stops accepting requests, flushes buffered telemetry for at most 5 seconds, and exits with code 0.
- **AC-06.5.5** Given an invalid configuration value (e.g. malformed telemetry endpoint, unknown log level), when the API starts, then it exits with a non-zero code and a message naming the offending setting.

### US-06.6 — One-command local telemetry backend (`COULD`)

As an evaluator, I want to start a local telemetry backend with one command, so that I can see traces, metrics and logs myself.

**Acceptance criteria**

- **AC-06.6.1** Given only the container runtime is installed, when the evaluator runs the documented observability command, then the telemetry backend's UI becomes reachable on the documented local address and the API exports to it without any file edit.
- **AC-06.6.2** Given the backend is running and a request has been made, then within 30 seconds the request's trace can be found by its trace id, its logs are visible from the trace, and the RED and business metrics are queryable.
- **AC-06.6.3** Given the default start command (without the observability option), then the telemetry backend is not started.
- **AC-06.6.4** The documentation states the backend's resource requirement (about 4 GB of memory) and how to stop it and reclaim its storage.

### US-06.7 — Smoke and load tests with thresholds (`COULD`)

As a developer, I want repeatable smoke and load tests with explicit thresholds, so that the latency budget is verified rather than assumed.

**Acceptance criteria**

- **AC-06.7.1** Given the seeded stack is running, when the smoke test runs, then it signs in as the demo user, exercises every documented endpoint at least once and passes only if every check passes and no request fails.
- **AC-06.7.2** Given the seeded stack is running, when the load test runs, then it passes only if the task-list p95 latency is below 100 ms and the overall error rate is below 1 %; otherwise it exits with a non-zero code.
- **AC-06.7.3** Both tests run with only the container runtime installed, using a documented command.
- **AC-06.7.4** Data created by the tests is marked as test data and removed at the end of the run, so the demo data set is unchanged afterwards.

### US-06.8 — Production-readiness plan (`MUST`, brief §5)

As an evaluator, I want a documented production-readiness plan, so that I understand what would change beyond a local hiring test.

**Acceptance criteria**

- **AC-06.8.1** The plan covers at least caching, logging, scalability and security (brief), plus reliability, delivery and data lifecycle.
- **AC-06.8.2** Each item states the current state, the production change, and why or when it becomes necessary.
- **AC-06.8.3** The plan is linked from the project README.

## Business rules

| ID      | Rule                                                                                                                                                                  |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-06.1 | Telemetry is never required for correct behavior; telemetry failures never fail or slow a request.                                                                    |
| BR-06.2 | Credentials (passwords, session tokens, authorization and cookie values) never appear in any signal. Email and name are personal data and never appear in any signal. |
| BR-06.3 | Metric dimensions are low-cardinality and bounded (method, route template, status code, status values).                                                               |
| BR-06.4 | Probes are public; every other API route keeps its authentication requirement.                                                                                        |
| BR-06.5 | Every request has a request id and a trace id; both are returned to the caller (header and, on errors, envelope).                                                     |
| BR-06.6 | Business counters count _successful, persisted_ state changes only (after the change is stored).                                                                      |
| BR-06.7 | Readiness depends only on dependencies the API cannot serve without (the database); the telemetry backend is never a readiness dependency.                            |

## Edge cases

- Caller sends a malformed trace context → ignored, a new trace starts; request still succeeds.
- Caller sends an oversized or non-printable request id → replaced by a generated one (never echoed).
- Database slow but up → readiness times out at 2 s and reports not ready; it must not hang the probe.
- Burst of probe calls from the container runtime → no log or trace noise.
- Telemetry backend reachable but rejecting data → same behavior as unreachable (BR-06.1).
- A task created then completed inside the same request (create with status Done) → counts once as created and once as completed.
- Status changed to Done, reopened, then Done again → counted twice as completed (the counter measures completion events, not distinct tasks).

## Out of scope

- Alert routing, paging and on-call; SLO burn-rate alerting implementation (documented only).
- Telemetry from the mobile app.
- Telemetry sampling strategies beyond "record everything" (local volumes are tiny); production sampling is documented.

## Open questions

- **OQ-06.1** The default rate limit (100 requests/min per user) would make the load test fail with throttling responses. Proposed: the limit is configurable and the load-test command raises it for that run only. Needs confirmation by the owners of 001/003 (rate limiting).
- **OQ-06.2** Should the request id format be restricted to UUIDs, or any printable token up to 128 characters? Proposed: printable ASCII `[A-Za-z0-9._-]`, 1–128 characters.
