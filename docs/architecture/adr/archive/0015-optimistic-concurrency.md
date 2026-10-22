# ADR-0015 — Optimistic concurrency with `version` + ETag/If-Match

- **Status:** Superseded by [ADR-0020](../0020-simplify-architecture-for-the-hiring-test.md)
- **Superseded (2026-10-22):** ETag, `If-Match`, `412` and the retry-once policy (last-write-wins; `version` stays as data) — see ADR-0020.
- **Date:** 2026-10-20
- **Deciders:** software-architect, nestjs-specialist, database-specialist

## Context

The same user can edit a task from two devices, or an offline device can replay an edit made against an old copy ([ADR-0012](0012-offline-first-and-optimistic-updates.md)). With plain `PUT` the last writer silently overwrites the other change (lost update). The API must detect this without locking, while staying trivially usable from cURL (brief's request examples).

## Decision drivers

- Prevent lost updates on full replacements (`PUT`) and deletes made against stale data.
- No long-lived locks; stateless HTTP.
- Use standard HTTP semantics that generic clients and proxies understand.
- Opt-in: requests without the header keep working.
- Single atomic SQL statement per update.

## Considered options

### 1. Integer `version` column + `ETag`/`If-Match` (chosen)

- **+** Standard RFC 9110 conditional requests; `412 Precondition Failed` is the defined response.
- **+** Version check and update in one statement (`UPDATE … WHERE id = $1 AND owner_id = $2 AND version = $3`) — race-free.
- **+** The version is also in the body, so the app can send `If-Match` without reading headers.
- **−** One more column and an increment on every write.

### 2. `updatedAt` timestamp as the version

- **+** No extra column.
- **−** Millisecond collisions on fast successive writes; clock precision differs between JS and Postgres; weaker guarantee.

### 3. Pessimistic locking (`SELECT … FOR UPDATE`) / explicit lock endpoints

- **−** Locks cannot span an HTTP round trip or an offline period; deadlock and timeout handling for no benefit.

### 4. Last write wins (do nothing)

- **+** Simplest.
- **−** Silent data loss in exactly the multi-device/offline cases our persona has.

### 5. Mandatory `If-Match` (428 Precondition Required when missing)

- **+** Strongest guarantee.
- **−** Breaks simple cURL usage and quick actions; we keep it optional.

## Decision outcome

- `teams.version` and `tasks.version` (`int`, starts at 1) are incremented on every state change; a no-op (e.g. same status) does not bump it.
- Single-resource responses (`GET /:id` 200, `POST` 201, `PUT` 200, `PATCH` 200 — including idempotent replays) include **`ETag: W/"<version>"`** (weak: the representation may vary, e.g. `isOverdue` depends on today). Lists expose `version` per item in the body.
- `PUT`, `PATCH` and `DELETE` accept **`If-Match: W/"<n>"`** (strong form `"<n>"` also accepted; any other value → `412`). `If-Match` is checked before no-op detection: a same-status `PATCH` with a matching `If-Match` (or none) returns `200` with an unchanged `ETag`. A `@IfMatch()` param decorator parses it into `expectedVersion` passed in the command.
- The repository's `save(aggregate, expectedVersion?)` issues a conditional update; 0 affected rows → re-check existence: not found → `404`, otherwise `ConcurrencyConflict` → **`412 PRECONDITION_FAILED`** with `details: { currentVersion }`.
- **Check order:** request validation (`400 VALIDATION_FAILED`, Nest pipes) always runs before precondition checks (`412`), which run in the handler before no-op detection.
- Without `If-Match`, the update still increments the version (but does not check it).
- **Who bumps:** persistence, not the aggregate. Aggregates (`Team`, `Task`) only change state and report whether anything changed; the repository's conditional `UPDATE … SET version = version + 1 WHERE … AND version = $expected` is the single place the version is incremented, and a no-op skips the write. Handlers read the new version from the query side after the write.
- **Unassignment on `TeamDeleted`** changes a task's `teams`, so it bumps that task's `version` and `updatedAt` (its representation changed).
- **App usage:** edits (`PUT`) and deletes send `If-Match` from the cached `version`; the quick status toggle does not (last write wins is the intended semantics for a toggle). On `412` the app rolls back and refetches.
- `If-None-Match` / `304` for GET caching is not implemented (React Query already caches); noted as a possible addition.

## Consequences

**Positive**

- Lost updates are detected for every client that opts in, including offline replays.
- No locks; one SQL statement; easy to integration-test with two concurrent requests.

**Negative**

- Clients must surface a conflict UX ("changed elsewhere — reloaded"); covered in Spec 005.
- Deleting a team bumps the `version` of every task it was assigned to (decided). A stale offline `PUT` (sent with `If-Match`) carrying the deleted team id therefore gets `412` instead of `422 UNKNOWN_TEAMS`, and the app refetches.

**Neutral**

- Weak ETags are sufficient because we only use them for conditional writes, not byte-range caching.

## Links

- [Data model — concurrency](../../data-model.md#concurrency) · [API contracts — conventions](../../api-contracts.md#conventions)
- RFC 9110 §13.1.1 If-Match: https://www.rfc-editor.org/rfc/rfc9110#name-if-match
