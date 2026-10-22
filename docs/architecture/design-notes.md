# Design notes

Non-obvious facts about the API that the code no longer carries as comments ([AC-08.12](../specs/008-simplification/spec.md)). One bullet each; the decisions behind them are in the [ADRs](adr/README.md), the contract in [API contracts](api-contracts.md).

## Process and HTTP

- **Instrumentation loads first.** `node --import ./dist/instrumentation.js dist/main.js` patches `http`, `express` and `pg` before they are required, so `instrumentation.ts` may not import application code. It starts the SDK only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set and never stops the API from booting.
- **`bodyParser: false` in `main.ts`.** Better Auth reads the raw request stream on `/api/auth/*`; `IdentityModule` re-adds the JSON parser (100 kB, urlencoded off) for every other route.
- **Auth middleware runs in front of the Better Auth handler** (the module's `middleware` option), because Nest middleware would run after it: route allowlist (anything else under `/api/auth` is 404), then the 16 kB body cap, then the client address.
- **The 16 kB cap wraps `request.push`**, not a `data` listener: a listener would start the stream before the handler attaches and lose chunks. A declared `Content-Length` over the cap answers 413 before anything is read; chunked bodies are counted as they arrive.
- **The client address is one trusted header.** `clientIpMiddleware` drops any client-sent `x-tt-client-ip` and writes the resolved address there; Better Auth's limiter reads only that header. `req.ip` follows `X-Forwarded-For` only through the `TRUSTED_PROXIES` CIDRs (Express `trust proxy`); with none it is the TCP peer.
- **Throttlers are two global guards.** The per-address one runs before the auth guard so floods are bounded before any session lookup, and refuses (429) a request with no resolvable address instead of giving it a bucket; the per-user one runs after authentication. Each applies only its named throttler and answers a plain `Retry-After`. Health probes skip both.
- **Bearer only.** The auth guard hands only the `Authorization` header to Better Auth, so a session cookie alone never authenticates `/api/v1`.
- **No ETag.** Express's automatic weak ETag is turned off; updates are last write wins (ADR-0020).
- **Exit code 0 on SIGTERM.** After all shutdown hooks Nest re-raises the signal, which ends the process with 143; `GracefulExit`, a root-module provider whose hook runs last, turns that final re-raise into `exit(0)`. It relies on a Nest internal; the compose smoke (`docker compose stop api` exits 0) catches a change.
- **Unmapped errors are never echoed.** Domain-error mappings use fixed text, framework 4xx use a fixed message per status: exception messages can carry paths, query strings, bodies or row values. Unexpected errors log `{ name, code }` only.

## Logging and telemetry

- **`route` is recorded by an accessor.** Express assigns `req.route` for every route layer and Nest's catch-all middleware route overwrites the handler's, so `route-template.ts` defines a setter on `req.route` before routing (in `genReqId`) and keeps the last non-wildcard template. It depends on Express 5 internals; the `/api/v1/tasks/:id` logger test guards it.
- **The request serializer runs at request start**, before routing, so `req.url` is the path without query string; the route template is added to the completion line when the response is written.
- **`traceId` is the request id when there is no trace.** The same fallback the error envelope uses; with a span the mixin supplies the real `traceId` and `spanId`. A client `X-Request-Id` is echoed only if it matches `^[A-Za-z0-9._-]{1,128}$`, which keeps log injection out of the id.
- **The pino instrumentation is off** (`sdk-options.ts`): it would add `trace_id`/`span_id` next to the logger's fields and ship pino records over OTLP. `autoDetectResources` is off too, so the resource has only the service name. A disabled auto-instrumentation is simply absent from the list.
- **Exported spans are not scrubbed** (query strings, exception text, client address, SQL text): see [observability](../operations/observability.md#traces-when-enabled).
- **`pino-pretty` is a dev dependency.** `LOG_PRETTY=true` without it (the production image) falls back to JSON with one warning.
- **Redaction paths repeat each pattern to depth 3**, because pino wildcards match one level; names with a dash use the bracket form.
- **Better Auth log messages are sanitized** (URL query strings stripped, emails masked) and only `code`, `status`, `statusCode` and `name` of object arguments are forwarded.

## Database

- **The pg driver adapter opens no connection on `$connect`**, so the API probes with `SELECT 1` at boot and fails fast; on failure the pool is closed with a short grace, because closing waits for pending connection attempts that only end at the OS TCP timeout against a black-holed host.
- **pg is bounded at the source:** connect timeout 2 s, `query_timeout` 5 s. `query_timeout` is client side (the driver stops waiting, PostgreSQL keeps running the statement); there is no `statement_timeout`. Readiness keeps one `SELECT 1` outstanding and waits on it for 1.5 s, so probes never pile up on a hung pool and `/ready` recovers within seconds of the database returning.
- **List reads run in one `RepeatableRead` transaction** with their `count(*)`, so the page and the total come from one snapshot.
- **Name uniqueness is decided by PostgreSQL.** `lower(name)` partial unique indexes are the authority; the repository's duplicate check is a fast path and a concurrent create is settled by the index (letter-case-only renames exclude the team itself).
- **`TeamName.equals` approximates `lower()`.** On postgres:17-alpine (musl) `lower()` leaves circled letters (U+24B6–U+24CF) and Unicode 14+ code points (e.g. U+A7D0) unchanged, so `equals()` can see a collision the unique index does not; the index decides (only the in-memory fake is affected). `team-name-collation.int-spec` pins both lists: if DIVERGE fails after an image upgrade, move those rows to AGREE, never weaken the test.
- **A foreign-key violation on task team links becomes `UnknownTeams` without ids**; the use case asks `TeamLookup` which ids are missing, so foreign and never-existing teams are indistinguishable.
- **Task links are diff-synced** so unchanged links keep their row and `created_at`. Deleting a team is one transaction: soft delete, one set-based `UPDATE` bumping `version`/`updated_at` of the owner's linked live tasks, then `DELETE FROM task_teams`.
- **A single status filter is an equality** (`status = $n`), not `= ANY(...)`: only the equality lets `tasks_owner_status_created_idx` return rows already ordered. `team_ids` are ordered by the uuid so `task_teams_pkey` returns them sorted without a Sort node. `ORDER BY` comes only from a whitelist and always ends with `id`.
- **A `date` column travels as midnight UTC**; reading and writing in UTC keeps the calendar day independent of the server time zone. `DueDate` uses `setUTCFullYear` because `Date.UTC` maps years 0 to 99 to 1900 to 1999.
- **Malformed ids skip the query** (the uuid cast would fail) and read as "not found".

## Tests

- **Jest 30 ignores a per-project `testTimeout`.** The 120 s timeout of the integration and e2e projects is set by `jest.setTimeout()` in `test/support/after-env.ts`; `effective-timeout.ts` reads jest-circus's internal `TEST_TIMEOUT_SYMBOL` to prove it (verified on 30.5). Unit tests keep the 5 s default.
- **One PostgreSQL container per Jest run.** `global-setup.ts` starts it and migrates a template database; every test file clones it (`CREATE DATABASE … TEMPLATE`) and drops the clone after its apps and clients are closed (`DROP … WITH (FORCE)` ends leftover connections).
- **Time-zone tests run in a child Jest process** (`in-time-zone.ts`, probes in `test/probes/`): setting `process.env.TZ` inside a test has no effect because Jest sandboxes `process.env`. The probe timeout stays below the parent's.
- **A TCP proxy stands in for "the database going away"** (`test/support/tcp-proxy.ts`): `stop()` refuses connections, `blackhole()` accepts and stays silent, so tests never touch the shared container.
- **Architecture rules are tested with `node:test`**, not Jest: dependency-cruiser is ESM-only. The fixture cruise runs with the fixture as working directory because dependency-cruiser resolves tsconfig paths (`@test/*`) against it.
- **nestjs-pino keeps its root logger in module state**, so a log-capturing spec boots one app per file; pino-http writes the completion line on the response's `finish`, so tests wait for the line instead of reading it right away.
- **The telemetry e2e compiles its fixture once** (`test/telemetry/tsconfig.json` into `node_modules/.cache`) because the generated Prisma client cannot run through ts-node.
