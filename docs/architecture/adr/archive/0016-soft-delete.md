# ADR-0016 — Soft delete

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, database-specialist

## Context

Users delete teams and tasks from the app, sometimes by accident and sometimes from an offline device replaying a queued delete. Deleting a team must not delete its tasks (a task may belong to other teams, or to none). Team names must be unique per owner **among active teams**, so a deleted "Mobile" team must not block creating a new "Mobile". The API must behave as if deleted items do not exist (constitution §VI.2 style: `404`, no leaks).

## Decision drivers

- Recoverability and auditability (undo/restore as a future feature, support investigations).
- Correct uniqueness semantics with deleted rows present.
- Idempotent, replay-safe `DELETE`.
- Query performance not degraded by deleted rows.
- Simplicity in repositories (no accidental reads of deleted rows).

## Considered options

### 1. `deleted_at` timestamp + partial indexes (chosen)

- **+** Rows can be restored; deletion time is recorded.
- **+** Partial indexes (`WHERE deleted_at IS NULL`) keep uniqueness and hot-path indexes scoped to active rows, so deleted rows cost nothing on reads.
- **−** Every query must filter `deleted_at IS NULL`; a forgotten filter leaks data.
- **−** Storage grows until a purge runs.

### 2. Hard delete

- **+** Simplest; FKs with `ON DELETE CASCADE` clean the join table.
- **−** No undo; an accidental or replayed delete is unrecoverable; no forensic trail.

### 3. Archive tables (move rows to `deleted_tasks`)

- **+** Main tables stay clean.
- **−** Duplicate schemas to migrate; moving rows between tables in transactions; restores are complex.

### 4. Boolean `is_deleted`

- **−** Same costs as `deleted_at` but loses the when.

## Decision outcome

- `teams.deleted_at` and `tasks.deleted_at` (`timestamptz NULL`). The domain models deletion as behavior: `team.delete(now)` / `task.delete(now)` set `deletedAt` and raise `TeamDeleted` / `TaskDeleted`.
- **Repositories always** add `deleted_at IS NULL` (owned by the Prisma repository/read model base, not by callers); an integration test per repository asserts deleted rows are invisible to every read method.
- **Indexes** are partial: `teams (owner_id, lower(name)) UNIQUE WHERE deleted_at IS NULL` and the list indexes in the [data model](../../data-model.md#indexes-and-why).
- **Team deletion** soft-deletes the team **and hard-deletes its `task_teams` rows** in the same transaction ([ADR-0002](../0002-nestjs-clean-architecture-ddd-cqrs.md#teamdeleted-consistency)); tasks remain. The join table holds current assignments, not history, so keeping rows that point at a deleted team would only complicate every task query.
- **Task deletion** soft-deletes the task; its `task_teams` rows stay (invisible because the task is filtered) so a future restore keeps assignments; `taskCount` counts only non-deleted tasks.
- **HTTP:** `DELETE` returns `204`. Deleting an already-deleted or unknown id returns `404` (no existence leak); clients treat `404` on a replayed delete as success (the offline queue does).
- **Purge** of rows deleted more than N days ago is a **production improvement** (scheduled job), not implemented.

## Consequences

**Positive**

- Accidental deletes are recoverable by an operator; restore endpoints can be added without schema changes.
- Name reuse after delete works naturally.
- Hot queries are unaffected by deleted rows.

**Negative**

- Discipline needed: reads must go through repositories (enforced by layering rules — presentation cannot import Prisma).
- Personal-data deletion (e.g. GDPR erasure) needs the purge job or a user deletion cascade (`ON DELETE CASCADE` from `users`).

**Neutral**

- Integration and E2E tests create a soft-deleted team to prove it is invisible and its name reusable (the seed itself stays at the brief's 3 active teams).

## Links

- [Data model — soft delete](../../data-model.md#soft-delete)
- [ADR-0003 — PostgreSQL](../0003-postgresql.md) · [ADR-0015 — Optimistic concurrency](0015-optimistic-concurrency.md)
