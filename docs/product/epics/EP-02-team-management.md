# EP-02 — Team Management

- **Priority:** `MUST` (brief). Some extras inside are tagged `COULD`.
- **Bounded context:** Team Management (supporting subdomain), see the [domain model](../../architecture/overview.md#2-modules)
- **Spec:** [002-teams](../../specs/002-teams/spec.md)

## Goal

Marina can create, find, rename, recolor and remove the color-coded teams she uses to organize tasks. Team lists return pagination metadata.

## Business value

| For       | Value                                                                                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| End user  | Teams are the main way to slice work ("what is pending for Mobile?"). The team color is the visual cue on every task.                                                                                               |
| Evaluator | Covers the brief's "CRUD de times" and "ao listar, retornar metadata". It is also the first full vertical slice of the architecture: aggregate, value objects, CQRS, repository, contract and tests at every level. |
| EP-03     | Supplies the team directory (existence, ownership, name and color) used for task assignment and chips.                                                                                                              |

## Scope

- Create, view, update (full replacement) and delete (archive) a team.
- List teams with pagination metadata (`total`, `limit`, `offset`, `hasNextPage`), search by name, and sorting.
- Team rules: name 2–50 characters and unique per user (case-insensitive), color `#RRGGBB`, description ≤ 280 characters.
- Number of tasks per team.
- Deleting a team keeps its tasks and only unassigns them.
- Safe concurrent edits (version precondition) and safe retries of creation (idempotency key).
- Seed: 3 teams for the demo account.

## Out of scope

- Sharing teams with other users, team members, roles.
- Restoring (un-archiving) a deleted team; purge of archived teams (listed as a production improvement).
- Partial update (`PATCH`) of a team.
- Team icons, ordering by drag and drop, nesting.
- Mobile screens (EP-04 owns the teams list screen).

## User stories

| ID       | Title                                            | Priority | Spec                                       |
| -------- | ------------------------------------------------ | -------- | ------------------------------------------ |
| US-02.1  | Create a team                                    | `MUST`   | [002-teams](../../specs/002-teams/spec.md) |
| US-02.2  | List teams with pagination metadata              | `MUST`   | [002-teams](../../specs/002-teams/spec.md) |
| US-02.3  | Search teams by name                             | `MUST`   | [002-teams](../../specs/002-teams/spec.md) |
| US-02.4  | Sort teams                                       | `COULD`  | [002-teams](../../specs/002-teams/spec.md) |
| US-02.5  | View a team                                      | `MUST`   | [002-teams](../../specs/002-teams/spec.md) |
| US-02.6  | Update a team                                    | `MUST`   | [002-teams](../../specs/002-teams/spec.md) |
| US-02.7  | Delete a team                                    | `MUST`   | [002-teams](../../specs/002-teams/spec.md) |
| US-02.8  | See how many tasks a team has                    | `COULD`  | [002-teams](../../specs/002-teams/spec.md) |
| US-02.9  | Edit safely when another device changed the team | `COULD`  | [002-teams](../../specs/002-teams/spec.md) |
| US-02.10 | Retry team creation safely                       | `COULD`  | [002-teams](../../specs/002-teams/spec.md) |
| US-02.11 | Keep my teams private (owner isolation)          | `MUST`   | [002-teams](../../specs/002-teams/spec.md) |

## Traceability to the brief

| Brief item                                                                             | Stories                                                                                      |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| "CRUD de times"                                                                        | US-02.1, US-02.5, US-02.6, US-02.7                                                           |
| "Ao listar, retornar metadata (ex.: total/pagination)"                                 | US-02.2                                                                                      |
| Suggested contract `GET /api/teams?limit=&offset=&search=`                             | US-02.2, US-02.3                                                                             |
| Suggested contract `POST /api/teams { name, colorHex, description? }`, `PUT`, `DELETE` | US-02.1, US-02.6, US-02.7                                                                    |
| "CRUD de times e tarefas funcional via API" (acceptance)                               | US-02.1–US-02.7 (API), US-02.11 (owner scoping). The UI part is in EP-04 (US-04.2, US-04.3). |
| "Cores dos times aparecem como label/chip" (acceptance)                                | US-02.1 (color captured and validated). The chip is in EP-03 and EP-04.                      |
| "Seeds/fixtures (ex.: 3 times)"                                                        | Seed task in 002 (T-002-11)                                                                  |

## Success criteria

- Every `MUST` acceptance criterion in 002 (44 of 70; the other 26 are `COULD`) has at least one passing automated scenario.
- Team listing p95 < 100 ms locally with the seed plus 1,000 extra teams. Indexes back the default sort and the uniqueness check.
- Domain layer (`TeamName`, `ColorHex`, `Team`) line coverage ≥ 90 %, mutation score ≥ 80 %.
- No duplicate team names per user, even under concurrent requests. The database guarantees this, and a test proves it.

## Dependencies

| On                                                                                                                                                                                                                                                                                                                                                                                                                                         | Why                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| EP-01 / 001-auth API foundation tasks                                                                                                                                                                                                                                                                                                                                                                                                      | Config, persistence module, error envelope, authentication and `CurrentOwner`. |
| [ADR-0002](../../architecture/adr/0002-nestjs-clean-architecture-ddd-cqrs.md), [ADR-0005](../../architecture/adr/0005-rest-openapi-and-response-envelope.md), [ADR-0006](../../architecture/adr/0006-offset-pagination.md), [ADR-0015](../../architecture/adr/archive/0015-optimistic-concurrency.md), [ADR-0016](../../architecture/adr/archive/0016-soft-delete.md), [ADR-0019](../../architecture/adr/archive/0019-idempotency-keys.md) | Architectural decisions applied here first.                                    |

| Depended on by | Why                                                                                    |
| -------------- | -------------------------------------------------------------------------------------- |
| EP-03          | Team directory for assignment and chips; `TeamDeleted` reaction; task counts per team. |
| EP-04          | Teams list screen, filtering tasks by team.                                            |

## Risks

| Risk                                                                                             | Impact                                            | Mitigation                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Task count and "unassign on delete" need the tasks context, which does not exist yet             | 002 cannot fully verify US-02.7 and US-02.8 alone | The teams context exposes ports. The tasks context (003) provides the adapters, and the cross-context scenarios are verified in 003 tasks (tracked in `tasks.md`). |
| Case-insensitive uniqueness differs between the application and the database for non-ASCII names | Rare false conflict or a missed conflict          | The database index is authoritative. Unit and integration tests include accented names.                                                                            |
| Shared cross-cutting pieces (pagination, ETag, idempotency) are first built here                 | Teams-specific shortcuts leak into shared code    | Build them in `shared/` with their own tests. EP-03 reuses them unchanged.                                                                                         |
