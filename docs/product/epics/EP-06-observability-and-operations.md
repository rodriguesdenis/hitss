# EP-06 — Observability & Operations

- **Spec:** [006-observability](../../specs/006-observability/spec.md)
- **Bounded context:** cross-cutting (platform)
- **Priority:** mostly `COULD` (our extra); US-06.8 is `MUST` (the brief requires a "what I'd do differently in production" section).
- **Principles:** [Constitution VII — Operability](../../constitution.md#vii-operability), [VI — Security by default](../../constitution.md#vi-security-by-default)
- **ADRs:** [0013](../../architecture/adr/0013-opentelemetry-and-signoz.md), [0018](../../architecture/adr/0018-docker-compose-one-command-run.md)

## Goal

Make the API **observable and operable from day one**: an operator (or the evaluator) can tell whether the service is alive and ready, follow any single request end to end, read logs correlated to that request without ever seeing a credential, watch rate / errors / duration and business counters, and verify a performance budget — while none of this is required for the API to run.

## Why

- The evaluator judges "production-grade practices". Showing one request as a single trace with correlated logs is the most convincing evidence.
- Health probes are what allows `docker compose up` to wait for a _ready_ API (EP-07).
- A written production-readiness plan is explicitly requested by the brief.

## Personas

| Persona                                          | Need                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **Operator / SRE** (the evaluator acting as one) | Know if the service is healthy, find why a request failed, see latency and error trends. |
| **Developer**                                    | Debug locally with readable, correlated logs; verify a change did not regress latency.   |
| **Marina** (end user, indirect)                  | Fast, reliable app; support can trace her problem from an error id.                      |

## User stories

| ID      | Story                                                                                                                                              | Priority                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| US-06.1 | As an operator, I want liveness and readiness probes, so that orchestration only routes traffic to an instance that can serve it.                  | `COULD` (required by Constitution VII.1) |
| US-06.2 | As an operator, I want every request traced end to end (entry → use case → database), so that I can locate where time is spent or where it failed. | `COULD`                                  |
| US-06.3 | As an operator, I want structured logs correlated with the trace and free of secrets, so that I can investigate safely.                            | `COULD`                                  |
| US-06.4 | As an operator, I want rate/errors/duration metrics per route and business counters, so that I can watch health and usage trends.                  | `COULD`                                  |
| US-06.5 | As an evaluator, I want the API to work normally when no telemetry backend is running, so that observability never blocks running the project.     | `COULD` (Constitution VII.2)             |
| US-06.6 | As an evaluator, I want to start a local telemetry backend with one command, so that I can see traces, metrics and logs myself.                    | `COULD`                                  |
| US-06.7 | As a developer, I want repeatable smoke and load tests with explicit thresholds, so that the latency budget is verified, not assumed.              | `COULD`                                  |
| US-06.8 | As an evaluator, I want a documented production-readiness plan, so that I understand what would change beyond a local hiring test.                 | `MUST` (brief §5)                        |

## Success metrics

| Metric                                                                                                                       | Target                                              |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| A request made from the app appears as **one trace** with entry, handler and database spans, and its logs share the trace id | 100 % of API requests (when the backend is running) |
| Task-list p95 latency, local, seeded, under the load profile                                                                 | < 100 ms                                            |
| Error rate under the load profile                                                                                            | < 1 %                                               |
| Credentials found in logs (automated check)                                                                                  | 0                                                   |
| API start-up with telemetry backend unreachable                                                                              | succeeds, serves requests                           |

## Out of scope

- Production alerting delivery (pager, chat). Alerts are _defined_ (documented), not wired to a notification channel.
- Mobile app telemetry (crash reporting, RUM) — listed in production readiness.
- Hosted observability or long-term retention.

## Dependencies

- EP-07 (Docker Compose run) consumes the readiness probe.
- EP-03 provides the domain events counted by the business metrics.
- EP-01 provides authentication, whose credentials must be redacted.
