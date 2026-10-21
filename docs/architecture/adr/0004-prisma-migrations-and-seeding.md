# ADR-0004 — Prisma ORM, migrations and deterministic seeding

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, database-specialist

## Context

The API needs type-safe database access, versioned schema migrations that run automatically on container start, and a seed (brief: 3 teams, 10 tasks) that an evaluator can run repeatedly with the same result. Better Auth must share the same database and schema tooling. Repositories are infrastructure adapters behind ports ([ADR-0002](0002-nestjs-clean-architecture-ddd-cqrs.md)), so the ORM never leaks into the domain.

## Decision drivers

- End-to-end type safety from schema to query results.
- Migrations that are reviewable SQL files, applied non-interactively in Docker and CI.
- Escape hatch to raw SQL for PostgreSQL features (partial indexes, trigram, `UPDATE … WHERE version = $n`).
- First-class Better Auth adapter and OpenTelemetry instrumentation.
- Reproducible seed: deterministic and idempotent.

## Considered options

### 1. Prisma (chosen)

- **+** Schema-first, generated typed client; `prisma migrate dev` creates SQL migrations we can edit; `prisma migrate deploy` applies them in production mode.
- **+** Official Better Auth adapter (`better-auth/adapters/prisma`) and `@prisma/instrumentation` for OTel spans.
- **+** `$transaction` (interactive) supports the unit of work; `$queryRaw` tagged templates for safe raw SQL.
- **−** Schema DSL cannot express partial, expression or GIN indexes → raw SQL in migrations, and `prisma migrate diff` must not "fix" them (we keep them in dedicated migrations and document it).
- **−** Generated client is a build step (handled by Turbo `prisma generate`).

### 2. TypeORM

- **+** Long-standing Nest integration (`@nestjs/typeorm`), decorators on entities.
- **−** Entities-as-decorated-classes push toward Active Record / anemic models mixing persistence with domain; weaker type inference for partial selects; historically unstable migration generation.

### 3. Drizzle ORM

- **+** SQL-like, light, excellent types, supports partial indexes in schema.
- **−** Younger migration tooling; Better Auth adapter exists but the Nest ecosystem examples and reviewer familiarity are lower. A reasonable alternative; Prisma wins on ecosystem breadth.

### 4. Kysely (query builder)

- **+** Precise SQL control with types.
- **−** No migrations generation or schema source of truth; more hand-written code for a CRUD-heavy domain.

## Decision outcome

Use **Prisma** (current major, PostgreSQL driver adapter) with:

- **Schema** in `apps/api/prisma/schema.prisma`; Better Auth tables generated with the Better Auth CLI (the `auth` package: `auth generate --adapter prisma`, then mapped to snake_case) into the same schema.
- **Explicit** `TaskTeam` join model (not implicit m-n) — see [data model](../data-model.md#relationships).
- **Migrations** created with `prisma migrate dev --create-only` when raw SQL must be appended (partial unique index on `lower(name)`, partial list indexes, `CREATE EXTENSION pg_trgm` + GIN index). Every migration is committed and reviewed as SQL.
- **Apply** with `prisma migrate deploy` in the one-shot `migrate` compose service ([ADR-0018](0018-docker-compose-one-command-run.md)) and in integration tests against Testcontainers.
- **Mappers** in `infrastructure/` translate rows ↔ aggregates; Prisma types never cross into `application/` or `domain/` (dependency-cruiser rule A2).
- **Seed** `prisma/seed.ts`:
  - deterministic: **fixed literal fixtures** (no faker or random data) — a fixed UUID for the demo user (stored in Better Auth's `text` id column) and fixed UUIDs, titles and descriptions for teams and tasks; due dates of overdue/upcoming tasks are computed **relative to the seeding day** (e.g. today − 3 days, today + 7 days), so the "overdue" task is always overdue;
  - idempotent: teams and tasks are `upsert`ed by fixed id and the demo user is only created when absent, so running it on every container start is safe;
  - creates `demo@teams-tasks.dev` through Better Auth's API (so the password hash matches the library's algorithm), 3 teams, 10 tasks covering every status, a multi-team task, a task without team and an overdue task.
- Scripts: `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:reset` (drop → migrate → seed).

## Consequences

**Positive**

- Fully typed persistence; schema drift is caught at compile time.
- One command reproduces the exact dataset used by docs, Bruno collection and Maestro flows.
- SQL migrations are explicit artifacts reviewers can read.

**Negative**

- Raw-SQL indexes are invisible to the Prisma schema; we add a comment in `schema.prisma` pointing to the migration and an integration test that asserts the indexes exist.
- Mapping code between rows and aggregates must be maintained (covered by repository integration tests).

**Neutral**

- Seeding on every start is cheap at this size; in production the seed would be disabled via an env flag (`SEED_ON_START=false`).

## Links

- [Data model](../data-model.md) · [ADR-0003 — PostgreSQL](0003-postgresql.md)
- Prisma migrate: https://www.prisma.io/docs/orm/prisma-migrate · Better Auth Prisma adapter: https://www.better-auth.com/docs/adapters/prisma
