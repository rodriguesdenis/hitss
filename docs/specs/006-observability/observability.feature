@api @ops
Feature: Observability and operations
  As an operator I can tell whether the API is alive and ready, follow any request
  end to end as one trace, read correlated logs that never contain credentials,
  and watch rate, errors, duration and business counters. None of this is required
  for the API to work: with no telemetry backend the API behaves identically.

  Background:
    Given the API is running against a seeded database
    And the demo user "demo@teams-tasks.dev" exists

  Rule: Liveness reports the process only; readiness reports the ability to serve

    @US-06.1 @AC-06.1.1 @could
    Scenario: Liveness answers without credentials and without dependencies
      Given the database is unreachable
      When an anonymous client checks liveness
      Then the API reports it is up

    @US-06.1 @AC-06.1.2 @could
    Scenario: Readiness succeeds when the database is reachable
      When an anonymous client checks readiness
      Then the API reports it is ready
      And the database check is reported as up

    @US-06.1 @AC-06.1.3 @could
    Scenario: Readiness fails fast when the database is down
      Given the database is unreachable
      When an anonymous client checks readiness
      Then the API reports it is unavailable within 2 seconds
      And the database check is reported as down
      And liveness still reports the API is up

    @US-06.1 @AC-06.1.4 @could
    Scenario: Readiness recovers without a restart
      Given readiness reported unavailable because the database was unreachable
      When the database becomes reachable again
      Then readiness reports the API is ready
      And the API process was not restarted

    @US-06.1 @AC-06.1.5 @could
    Scenario: Probes are never throttled and produce no request noise
      When a client checks readiness 200 times within one minute
      Then every check is answered without throttling
      And no request log entry or trace is recorded for those checks

  Rule: Every request is one trace, from entry through the use case to the database

    @US-06.2 @AC-06.2.1 @could
    Scenario: Listing tasks produces a single trace with entry, use-case and database spans
      Given the telemetry backend is running
      And I am signed in as "demo@teams-tasks.dev"
      When I list my tasks
      Then exactly one trace is recorded for that request
      And its root span is named after the method and the route template
      And it contains a use-case span below the root span
      And it contains at least one database span below the use-case span

    @US-06.2 @AC-06.2.2 @could
    Scenario: An incoming trace context is continued
      Given I am signed in as "demo@teams-tasks.dev"
      When I list my tasks sending a valid trace context with trace id "4bf92f3577b34da6a3ce929d0e0e4736"
      Then the recorded trace has trace id "4bf92f3577b34da6a3ce929d0e0e4736"

    @US-06.2 @AC-06.2.2 @could
    Scenario: A malformed trace context is ignored
      Given I am signed in as "demo@teams-tasks.dev"
      When I list my tasks sending a malformed trace context
      Then the request succeeds
      And a new trace is started for it

    @US-06.2 @AC-06.2.3 @could
    Scenario Outline: The request id is echoed when well formed, generated otherwise
      Given I am signed in as "demo@teams-tasks.dev"
      When I list my tasks sending request id "<sent>"
      Then the response request id is <returned>

      Examples:
        | sent                                 | returned                  |
        | 3f0c8a2e-6a7b-4c1d-9e8f-0a1b2c3d4e5f | the same value            |
        | client-req_42.retry-1                | the same value            |
        |                                      | a newly generated value   |
        | <script>alert(1)</script>            | a newly generated value   |
        | 129 characters long                  | a newly generated value   |

    @US-06.2 @AC-06.2.4 @could
    Scenario: Error envelopes carry the trace id
      Given I am signed in as "demo@teams-tasks.dev"
      When I create a task with a 2-character title
      Then the request is rejected as invalid
      And the error envelope contains the trace id of that request's trace

    @US-06.2 @AC-06.2.5 @could
    Scenario: Spans contain no credentials, bodies or personal data
      Given the telemetry backend is running
      When I sign in as "demo@teams-tasks.dev" with password "Demo@1234"
      And I list my tasks
      Then no recorded span attribute contains "Demo@1234"
      And no recorded span attribute contains "demo@teams-tasks.dev"
      And no recorded span attribute contains my session token
      And no database span contains query parameter values

    @US-06.2 @AC-06.2.6 @could
    Scenario: Telemetry identifies the service
      Given the telemetry backend is running
      When any request is traced
      Then its telemetry names the service "teams-tasks-api"
      And it states the service version and the deployment environment

  Rule: Logs are structured, correlated with the trace and never contain secrets

    @US-06.3 @AC-06.3.1 @could
    Scenario: One structured completion entry per request
      Given I am signed in as "demo@teams-tasks.dev"
      When I list my tasks
      Then exactly one completion log entry is written for that request
      And it contains the method, route template, status code, duration, request id, trace id and span id

    @US-06.3 @AC-06.3.2 @could
    Scenario: Entries written during a request share its correlation ids
      Given I am signed in as "demo@teams-tasks.dev"
      When I create a task titled "Write release notes"
      Then every log entry written while handling that request has the request's request id and trace id

    @US-06.3 @AC-06.3.3 @could
    Scenario Outline: Sensitive values never reach the logs
      Given the log level is the most verbose level
      When a request carrying <sensitive value> is handled
      Then the logs do not contain that value
      And the logs show a redaction marker in its place or omit the field

      Examples:
        | sensitive value                                 |
        | the password of a sign-up                       |
        | the password of a sign-in                       |
        | an authorization header with a session token    |
        | a session cookie                                |
        | a session token returned in a response header   |
        | a session cookie returned in a response header  |
        | a new password or current password nested in a request body |
        | a token nested inside an object in a request body |

    @US-06.3 @AC-06.3.7 @could @security
    Scenario: Request bodies and auth query strings are never logged
      Given the log level is the most verbose level
      When I sign in and I create a task with a description "private notes"
      Then no log entry contains a request body or the text "private notes"
      When a client calls a path under the authentication routes with a query string carrying a token
      Then the logged URL has no query string

    @US-06.3 @AC-06.3.8 @could @security
    Scenario Outline: Library loggers do not leak secrets
      Given the log level is the most verbose level
      When <situation>
      Then no log entry contains the secret, the password or a query parameter value

      Examples:
        | situation                                                         |
        | the authentication library logs a warning during a failed sign-in |
        | the database client logs a slow query with bound parameters       |

    @US-06.3 @AC-06.3.4 @could
    Scenario: Unexpected errors are logged in full and answered generically
      Given an unexpected failure occurs while listing tasks
      When I list my tasks
      Then the response is an internal error with a generic message and the trace id
      And the response contains no stack trace or database detail
      And exactly one error-level log entry with the error type and stack trace is written with that trace id

    @US-06.3 @AC-06.3.5 @could
    Scenario: Default log output is machine readable
      Given the default logging configuration
      When any request is handled
      Then each log entry is one machine-readable object on its own line
      And entries below the info level are not written

    @US-06.3 @AC-06.3.6 @could
    Scenario: Logs identify the user only by opaque id
      Given I am signed in as "demo@teams-tasks.dev"
      When I list my tasks
      Then the completion entry contains my user id
      And no log entry contains my email address or my name

  Rule: Metrics expose rate, errors, duration and business counters with bounded dimensions

    @US-06.4 @AC-06.4.1 @could
    Scenario: Request durations are recorded per route, method and status
      Given I am signed in as "demo@teams-tasks.dev"
      When I list my tasks 5 times
      And I request a task that does not exist
      Then the request duration distribution has 5 samples for listing tasks with a success status
      And it has 1 sample for getting a task with a not-found status

    @US-06.4 @AC-06.4.2 @could
    Scenario: Creating a task counts once, replays and rejections do not count
      Given I am signed in as "demo@teams-tasks.dev"
      And the "tasks created" counter has value N
      When I create a task titled "Plan sprint" with idempotency key "K1"
      And I repeat the same creation with idempotency key "K1"
      And I create a task with a 2-character title
      Then the "tasks created" counter has value N + 1

    @US-06.4 @AC-06.4.3 @could
    Scenario Outline: Only a change into Done counts as a completion
      Given I am signed in as "demo@teams-tasks.dev"
      And I have a task with status "<from>"
      And the "tasks completed" counter has value N
      When I change its status to "<to>"
      Then the "tasks completed" counter has value <expected>

      Examples:
        | from        | to          | expected |
        | Pending     | Done        | N + 1    |
        | In progress | Done        | N + 1    |
        | Done        | Done        | N        |
        | Pending     | In progress | N        |
        | Done        | Pending     | N        |

    @US-06.4 @AC-06.4.4 @could
    Scenario: Metric dimensions are low cardinality
      Given I am signed in as "demo@teams-tasks.dev"
      When I get, update and delete a specific task and search tasks for "login"
      Then no metric dimension contains a user id, an email, a resource id, a search term or a raw URL
      And request metrics are dimensioned by route template only

    @US-06.4 @AC-06.4.5 @could
    Scenario: Deleting a task counts once
      Given I am signed in as "demo@teams-tasks.dev"
      And I have a task titled "Obsolete"
      And the "tasks deleted" counter has value N
      When I delete that task
      Then the "tasks deleted" counter has value N + 1

  Rule: Telemetry is optional; it never blocks, fails or slows the API

    @US-06.5 @AC-06.5.1 @could
    Scenario: The API starts and serves with the collector unreachable
      Given the telemetry backend is unreachable
      When the API starts
      Then it reports ready within its normal start-up time
      And signed-in users can list, create and update tasks normally

    @US-06.5 @AC-06.5.2 @could
    Scenario: The backend going away does not affect requests
      Given the telemetry backend is running
      When the telemetry backend stops
      And signed-in users keep using the API for 3 minutes
      Then every request succeeds
      And at most 3 telemetry export warnings are logged

    @US-06.5 @AC-06.5.3 @could
    Scenario: Telemetry can be disabled completely
      Given telemetry is disabled by configuration
      When the API starts and serves requests
      Then no telemetry is exported
      And completion log entries are still written with a request id

    @US-06.5 @AC-06.5.4 @could
    Scenario: Graceful shutdown flushes telemetry
      Given the telemetry backend is running
      And requests have just been served
      When the API receives a termination signal
      Then it stops accepting new requests
      And the last requests' traces reach the backend
      And the process exits with code 0 within 10 seconds

    @US-06.5 @AC-06.5.5 @could
    Scenario Outline: Invalid configuration fails fast
      Given the setting "<setting>" is "<value>"
      When the API starts
      Then it exits with a non-zero code
      And the start-up error names "<setting>"

      Examples:
        | setting            | value          |
        | telemetry endpoint | not a url      |
        | log level          | chatty         |
        | telemetry disabled | maybe          |

  Rule: A local telemetry backend is one opt-in command away

    @US-06.6 @AC-06.6.1 @AC-06.6.2 @could
    Scenario: The evaluator finds a request's trace, logs and metrics
      Given only the container runtime is installed
      And the evaluator started the stack with the observability option
      When the evaluator signs in and lists tasks
      Then within 30 seconds the request's trace can be found by its trace id in the telemetry UI
      And the request's log entries are reachable from that trace
      And the request rate and the "tasks created" counter can be charted

    @US-06.6 @AC-06.6.3 @could
    Scenario: The default start does not run the telemetry backend
      When the evaluator starts the stack with the default command
      Then the telemetry backend is not running
      And the API is ready

    @US-06.6 @AC-06.6.4 @could @docs
    Scenario: Resource needs and clean-up are documented
      When the evaluator reads the observability instructions
      Then they state that the telemetry backend needs about 4 GB of memory
      And they explain how to stop it and reclaim its storage

  Rule: Performance budgets are verified by repeatable tests

    @US-06.7 @AC-06.7.1 @AC-06.7.3 @could
    Scenario: The smoke test exercises every endpoint
      Given the seeded stack is running
      When the smoke test runs using only the container runtime
      Then every documented endpoint is called at least once
      And every check passes and no request fails

    @US-06.7 @AC-06.7.2 @could
    Scenario: The load test is not throttled by the default rate limits
      Given the default limits are 100 requests per minute per user and 300 per address
      When the load test runs with its documented command
      Then that run uses raised per-user and per-address limits
      And no request is answered with "RATE_LIMITED"
      And the defaults are unchanged for every other run

    @US-06.7 @AC-06.7.2 @could
    Scenario Outline: The load test enforces the latency and error budget
      Given the seeded stack is running
      When the load test runs and measures a task-list p95 of <p95> and an error rate of <errors>
      Then the load test <result>

      Examples:
        | p95    | errors | result                   |
        | 60 ms  | 0 %    | passes                   |
        | 99 ms  | 0.9 %  | passes                   |
        | 100 ms | 0 %    | fails with non-zero exit |
        | 40 ms  | 1 %    | fails with non-zero exit |

    @US-06.7 @AC-06.7.4 @could
    Scenario: Test runs leave the demo data unchanged
      Given the demo user has 3 teams and 10 tasks
      When the smoke test and the load test have run
      Then the demo user still has 3 teams and 10 tasks

  Rule: The production-readiness plan is documented

    @US-06.8 @AC-06.8.1 @AC-06.8.2 @AC-06.8.3 @must @docs
    Scenario: The production-readiness plan answers the brief
      When the evaluator opens the README
      Then it links to the production-readiness plan
      And the plan covers caching, logging, scalability, security, reliability, delivery and data lifecycle
      And every item states the current state, the production change and why it is needed
