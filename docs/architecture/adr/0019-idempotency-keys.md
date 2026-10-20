# ADR-0019 — Idempotency keys on POST

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, nestjs-specialist

## Context

`POST /teams` and `POST /tasks` are not idempotent: a retry after a timeout, a double tap, or an offline mutation replayed after an app restart ([ADR-0012](0012-offline-first-and-optimistic-updates.md)) can create duplicates. On mobile networks "request sent, response lost" is common. `PUT`, `PATCH` (setting a status) and `DELETE` are already idempotent by HTTP semantics.

## Decision drivers

- Exactly-once _effect_ for creates under client retries.
- Survives API restarts (offline replays may come hours later).
- Detect misuse: same key with a different payload.
- Opt-in, so plain cURL works without headers.
- No new infrastructure (no Redis) for a one-command run.

## Considered options

### 1. `Idempotency-Key` header stored in PostgreSQL (chosen)

- **+** Follows the IETF draft `Idempotency-Key` header and the widely known Stripe semantics.
- **+** Stored in the same database; the key record and the created resource can be written in **one transaction**.
- **−** One extra table and a lookup per keyed POST.

### 2. Client-generated resource ids (`PUT /tasks/:clientId`)

- **+** Naturally idempotent; no extra table.
- **−** Changes the contract (create via `PUT`), lets clients choose primary keys, and does not detect payload mismatch.

### 3. Redis/in-memory cache of keys

- **+** Fast, TTL built in.
- **−** In-memory is lost on restart (offline replay case fails); Redis adds a service to Compose and cannot share a transaction with Postgres.

### 4. Natural-key de-duplication (e.g. same title within N seconds)

- **−** Heuristic; legitimately identical tasks would be rejected.

## Decision outcome

- **Header:** `Idempotency-Key: <uuid>` optional on `POST /api/v1/teams` and `POST /api/v1/tasks`. Invalid format → `400 VALIDATION_FAILED`.
- **Storage:** table `idempotency_keys (key, owner_id) PK, request_hash, response_status, response_body jsonb, expires_at` ([data model](../data-model.md)). Keys are **scoped per owner**, so users cannot collide or probe each other's keys.
- **Request hash:** SHA-256 of method + path + canonical JSON body.
- **Flow** (an `IdempotencyInterceptor` in shared presentation, backed by an `IdempotencyStore` port):
  1. No header → normal processing.
  2. Inside the transaction, take `pg_try_advisory_xact_lock` on a hash of `(owner_id, key)`. Not acquired → another request with this key is in flight → **`409 IDEMPOTENCY_REQUEST_IN_PROGRESS`** with `Retry-After: 1`; nothing is executed.
  3. Key found, not expired, same hash → **replay** stored status and body with `Location` and `ETag` rebuilt from the stored body, plus the header **`Idempotent-Replayed: true`**; the handler is not executed.
  4. Key found with a different hash → **`422 IDEMPOTENCY_KEY_REUSED`**.
  5. Key not found → execute the command and, in the **same transaction** as the create, insert the key row with the response. The advisory lock is released on commit/rollback, so a retry after `Retry-After` sees the committed key and gets rule 3 or 4.
  6. Safety net: if two transactions still race on the insert, the primary key makes the second fail with a unique violation; its whole transaction (including its create) rolls back and the interceptor re-reads the key and applies rule 3 or 4. No duplicate can be committed.
- **What is stored:** only successful (`2xx`) responses. Validation and domain errors are not stored, so a client can fix and retry with the same key.
- **TTL:** 24 h (`expires_at`); expired keys are ignored on lookup and removed by a small bounded batch delete of expired rows on insert; a scheduled purge is a production improvement.
- **Client:** the mobile mutator generates the key when the mutation is _created_ and persists it with the paused mutation, so replays reuse it.

## Consequences

**Positive**

- Retries and offline replays never create duplicate teams or tasks.
- Payload mismatch is reported, catching client bugs.
- A concurrent duplicate (double tap, retry racing the original) fails fast with `409` instead of waiting on a row lock; the mobile mutator retries after `Retry-After`.
- Works across API restarts; no extra infrastructure.

**Negative**

- Extra write per keyed POST; negligible at our volume.
- Stored response bodies may become stale (a replay returns the original representation, not the current one) — this is the intended semantics.

**Neutral**

- Applying keys to other methods is unnecessary; they are idempotent by design ([ADR-0015](0015-optimistic-concurrency.md) covers conflicting updates).

## Links

- [API contracts — conventions](../api-contracts.md#conventions)
- IETF draft: https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/ · Stripe: https://docs.stripe.com/api/idempotent_requests
