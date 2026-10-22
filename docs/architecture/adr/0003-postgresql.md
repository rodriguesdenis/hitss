# ADR-0003 — PostgreSQL as the database

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, database-specialist

## Context

The data is inherently relational: users own teams and tasks; tasks and teams form an **N:M** relationship; team names must be unique per owner among non-deleted rows (case-insensitive); task listing filters by team, status and free-text search with stable sorting and a `total` count. Deleting a team must atomically remove its assignments. The database must run in Docker with zero manual setup and in integration tests via Testcontainers.

## Decision drivers

- Referential integrity for the N:M relationship and owner scoping.
- Expressive constraints: **partial unique indexes** (`WHERE deleted_at IS NULL`), functional indexes (`lower(name)`), enums, checks.
- Efficient substring search (`ILIKE '%term%'`) without a separate search engine.
- ACID transactions spanning several tables (team deletion, idempotency record + resource).
- First-class support in Prisma, Better Auth and Testcontainers; official Docker image.

## Considered options

### 1. PostgreSQL 17 (chosen)

- **+** Foreign keys with `ON DELETE CASCADE`, composite PK on `task_teams`, partial and expression indexes, native enum types.
- **+** `pg_trgm` GIN indexes make `ILIKE '%login%'` index-assisted on title/description.
- **+** `COUNT(*) OVER()` or a parallel count query gives pagination `total` cheaply at our volumes.
- **+** Mature tooling everywhere (Prisma, Better Auth adapter, `@testcontainers/postgresql`, OpenTelemetry instrumentation).
- **−** Heavier than SQLite for local runs (mitigated by Docker Compose).

### 2. MongoDB

- **+** Flexible schema; embedding team summaries in tasks is natural for reads.
- **−** N:M with integrity requires application-level consistency; renaming a team means updating every embedded copy.
- **−** Partial unique indexes exist but case-insensitive uniqueness needs collations; multi-document transactions require a replica set even locally.
- **−** No relational constraint guarantees to lean on for ownership.

### 3. SQLite

- **+** Zero infrastructure; a single file.
- **−** No partial-index parity with Postgres in Prisma migrations workflows, no `pg_trgm`, limited concurrent writes; tests would not reflect production behavior.
- **−** "Production notes" would immediately say "replace the database", which undermines the exercise.

### 4. MySQL 8

- **+** Relational, widely known.
- **−** No partial indexes (would need generated columns to emulate soft-delete-aware uniqueness); full-text search does not do substring matching; fewer constraint features.

## Decision outcome

Use **PostgreSQL 17** (official `postgres:17-alpine` image) with the `pg_trgm` extension enabled in the first migration. Schema and indexes are described in the [data model](../data-model.md). Key choices:

- `task_status` native enum.
- Explicit join table `task_teams (task_id, team_id)` with both FKs `ON DELETE CASCADE`.
- `UNIQUE (owner_id, lower(name)) WHERE deleted_at IS NULL` on teams.
- Partial composite indexes matching the hot list queries; GIN trigram index for search.
- All timestamps `timestamptz` in UTC; `due_date` is a `date`.

## Consequences

**Positive**

- Invariants that span rows (uniqueness, FK integrity) are guaranteed by the database even if application code regresses — the handler check gives a nice error, the index is the safety net.
- Search and filter stay fast without Elasticsearch; p95 list latency target (< 100 ms) is realistic.
- Integration tests exercise the exact production engine through Testcontainers.

**Negative**

- Some features (partial/trigram indexes) cannot be expressed in Prisma schema and live as raw SQL in migrations ([ADR-0004](0004-prisma-migrations-and-seeding.md)).
- Requires Docker for local development and tests.

**Neutral**

- Offset pagination cost grows with offset; acceptable at our volumes ([ADR-0006](0006-offset-pagination.md)).

## Links

- [Data model](../data-model.md)
- [ADR-0016 — Soft delete](archive/0016-soft-delete.md) · [ADR-0015 — Optimistic concurrency](archive/0015-optimistic-concurrency.md)
- pg_trgm: https://www.postgresql.org/docs/17/pgtrgm.html
