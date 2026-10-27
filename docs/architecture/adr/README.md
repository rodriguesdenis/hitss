# Architecture Decision Records

Every significant or non-obvious decision in **Teams & Tasks** is recorded here, including the options we chose **not** to take (constitution §IX.3). Records use the [MADR](https://adr.github.io/madr/) format. The big picture is in the [architecture overview](../overview.md).

## Index

The decisions that shape the code as it is. Read ADR-0020 together with ADR-0002: it replaces the CQRS, module-contract and unit-of-work parts and gives the module layout in use.

| ADR                                                       | Decision                                                                                                                                         | Status                              | Date       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ---------- |
| [0001](0001-monorepo-pnpm-turborepo.md)                   | Monorepo with pnpm workspaces + Turborepo                                                                                                        | Accepted                            | 2026-10-20 |
| [0002](0002-nestjs-clean-architecture-ddd-cqrs.md)        | NestJS with Clean Architecture and DDD (CQRS part superseded)                                                                                    | Accepted, partly superseded by 0020 | 2026-10-20 |
| [0020](0020-simplify-architecture-for-the-hiring-test.md) | Simplify the architecture: use cases, `TeamDirectory` → `TeamLookup`, module layout and dependency rules, one transaction per write, Bearer only | Accepted, amended 2026-10-26        | 2026-10-22 |
| [0003](0003-postgresql.md)                                | PostgreSQL as the database                                                                                                                       | Accepted                            | 2026-10-20 |
| [0004](0004-prisma-migrations-and-seeding.md)             | Prisma ORM, migrations and deterministic seeding                                                                                                 | Accepted                            | 2026-10-20 |
| [0005](0005-rest-openapi-and-response-envelope.md)        | REST + OpenAPI with response/error envelopes                                                                                                     | Accepted                            | 2026-10-20 |
| [0006](0006-offset-pagination.md)                         | Offset pagination (vs cursor)                                                                                                                    | Accepted                            | 2026-10-20 |
| [0007](0007-better-auth.md)                               | Better Auth for authentication (Bearer tokens on `/api/v1`)                                                                                      | Accepted, partly superseded by 0020 | 2026-10-20 |
| [0014](0014-testing-strategy.md)                          | Testing strategy and tooling                                                                                                                     | Accepted                            | 2026-10-20 |
| [0018](0018-docker-compose-one-command-run.md)            | Docker Compose one-command run                                                                                                                   | Accepted                            | 2026-10-20 |

### Archive

Kept as the record, out of the main reading path. One line each: what it decided and where it stands now.

| ADR                                                               | Decision                                                   | Where it stands                                                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [0008](archive/0008-class-validator-dtos-and-generated-client.md) | class-validator DTOs as the contract source + orval client | In force for the DTOs; the generated client arrives with the mobile app                               |
| [0009](archive/0009-expo-and-expo-router.md)                      | Expo (managed, Expo Go) + Expo Router                      | Accepted for the mobile phase, not built yet                                                          |
| [0010](archive/0010-react-query-and-zustand-immer.md)             | React Query + Zustand/immer                                | Accepted for the mobile phase, not built yet                                                          |
| [0011](archive/0011-nativewind-with-apply.md)                     | NativeWind v4 with `@apply` semantic classes               | Accepted for the mobile phase, not built yet                                                          |
| [0012](archive/0012-offline-first-and-optimistic-updates.md)      | Offline-first cache and optimistic updates                 | Accepted for the mobile phase; conflict handling simplified, the API has no `412` (ADR-0020)          |
| [0013](archive/0013-opentelemetry-and-signoz.md)                  | OpenTelemetry + SigNoz                                     | Partly superseded by 0020: auto-instrumentation, OTLP only when an endpoint is set, no SigNoz profile |
| [0015](archive/0015-optimistic-concurrency.md)                    | `version` + ETag / `If-Match`                              | Superseded by 0020: last write wins, `version` kept as data                                           |
| [0016](archive/0016-soft-delete.md)                               | Soft delete                                                | In force; described in the [data model](../data-model.md#soft-delete)                                 |
| [0017](archive/0017-conventional-commits-and-atomic-prs.md)       | Conventional Commits and atomic PRs                        | In force (commitlint, one task per PR)                                                                |
| [0019](archive/0019-idempotency-keys.md)                          | Idempotency keys on `POST`                                 | Accepted, not implemented (deferred COULD)                                                            |

## When to write an ADR

Write one when a decision:

- is hard or expensive to reverse (database, framework, contract style, auth);
- chooses between credible alternatives a reviewer might ask about;
- changes or interprets a principle in the [constitution](../../constitution.md) (mandatory);
- introduces a new cross-cutting dependency, layer rule or convention.

Do **not** write one for choices fully determined by an existing ADR or for local implementation details (those belong in a spec's `plan.md`, which links the ADRs it relies on).

## How to write one

1. Copy the template below to `NNNN-kebab-title.md` using the next free number (numbers are never reused).
2. Fill **every** section. List at least two real alternatives with honest pros and cons — including the option of doing nothing when relevant.
3. Keep it to **one decision**. If you find yourself writing "and also", split it.
4. Open the ADR in its own PR with scope `adr` (e.g. `docs(adr): add 0020 rate limiting strategy`), status `Proposed`. It becomes `Accepted` when the PR is approved and merged.
5. Add it to the index above and link it from the affected docs (overview, data model, plans).

### Template

```markdown
# ADR-NNNN — <Decision title>

- **Status:** Proposed | Accepted | Deprecated | Superseded by [ADR-XXXX](XXXX-….md)
- **Date:** YYYY-MM-DD
- **Deciders:** <agents / people>

## Context

What forces are at play? Requirements, constraints, the problem.

## Decision drivers

- Bullet list of criteria used to compare options.

## Considered options

### 1. <Option> (chosen)

- **+** pros
- **−** cons

### 2. <Option>

…

## Decision outcome

What we do, specifically enough to implement and review against.

## Consequences

**Positive** · **Negative** · **Neutral**

## Links

Specs, other ADRs, external references.
```

## Changing a decision (superseding)

ADRs are **immutable history**. Never rewrite the reasoning of an accepted ADR.

- To change a decision, write a **new** ADR that explains what changed and why. Set its links to the old one ("Supersedes ADR-0006").
- Edit the old ADR **only** to change its status line to `Superseded by [ADR-NNNN](…)` and update the index.
- To retire a decision without a replacement, set its status to `Deprecated` with a one-line reason.
- Typo fixes and broken links may be corrected in place.

## Statuses

| Status     | Meaning                               |
| ---------- | ------------------------------------- |
| Proposed   | Under review in an open PR.           |
| Accepted   | In force; code and plans must comply. |
| Deprecated | No longer applies; no replacement.    |
| Superseded | Replaced by the linked ADR.           |
