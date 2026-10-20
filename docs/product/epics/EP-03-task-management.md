# EP-03 — Task Management

- **Bounded context:** Task Management (**core domain**) · **Spec:** [003-tasks](../../specs/003-tasks/spec.md) · **Status:** Draft
- **Persona:** Marina, team lead ([vision](../vision.md#persona))

## Goal

Let a user capture, find and move their work forward: create tasks, assign each to zero or more color-coded teams, find them by team, status or text, and change their status in one action.

## Business value

| For             | Value                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| End user        | One list of all work, sliceable per team; "what is pending for team X" answered in one request; status updated in one tap.                       |
| Evaluator       | The richest domain in the project: invariants, value objects, free status lifecycle, cross-context collaboration, read model, query performance. |
| Brief alignment | Covers the brief's task CRUD, status, multi-team assignment and the `teamId` / `status` / `search` / sort / pagination listing (all **MUST**).   |

## Scope

**In scope**

- Task lifecycle: create, view, edit (replace), quick status change, delete (archive).
- Assignment of a task to 0–10 of the owner's teams; team display data (name, color) embedded in every task.
- Listing: global or per team, status filter (one or many), text search, sorting, offset pagination with metadata.
- Derived **overdue** flag; completion time recorded on entering **Done**.
- Owner isolation of every read and write.
- Reaction to team deletion (tasks survive, the team is unassigned).
- Production-grade extras: optimistic concurrency, idempotent creation.

**Out of scope**

- Assigning tasks to people, sharing, collaboration, notifications, comments, attachments ([vision](../vision.md#out-of-scope)).
- Sub-tasks, priorities, labels other than teams, recurring tasks, reminders.
- Restoring (un-deleting) tasks, bulk operations, multi-field sort, cursor pagination, relevance-ranked full-text search.
- Mobile screens (EP-04) and offline queueing (EP-05) — they consume this epic's contract.

## User stories

| ID       | Title                             | Priority | Spec                                                                                  |
| -------- | --------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| US-03.1  | Create a task                     | MUST     | [spec](../../specs/003-tasks/spec.md#us-031--create-a-task-must)                      |
| US-03.2  | List my tasks                     | MUST     | [spec](../../specs/003-tasks/spec.md#us-032--list-my-tasks-must)                      |
| US-03.3  | Filter tasks by team              | MUST     | [spec](../../specs/003-tasks/spec.md#us-033--filter-tasks-by-team-must)               |
| US-03.4  | Filter tasks by status            | MUST     | [spec](../../specs/003-tasks/spec.md#us-034--filter-tasks-by-status-must)             |
| US-03.5  | Search tasks by text              | MUST     | [spec](../../specs/003-tasks/spec.md#us-035--search-tasks-by-text-must)               |
| US-03.6  | Sort tasks                        | MUST     | [spec](../../specs/003-tasks/spec.md#us-036--sort-tasks-must)                         |
| US-03.7  | Paginate tasks                    | MUST     | [spec](../../specs/003-tasks/spec.md#us-037--paginate-tasks-must)                     |
| US-03.8  | View a task                       | MUST     | [spec](../../specs/003-tasks/spec.md#us-038--view-a-task-must)                        |
| US-03.9  | Edit a task (including its teams) | MUST     | [spec](../../specs/003-tasks/spec.md#us-039--edit-a-task-must)                        |
| US-03.10 | Change a task's status quickly    | MUST     | [spec](../../specs/003-tasks/spec.md#us-0310--change-a-tasks-status-quickly-must)     |
| US-03.11 | Delete a task                     | MUST     | [spec](../../specs/003-tasks/spec.md#us-0311--delete-a-task-must)                     |
| US-03.12 | Keep my tasks private             | COULD ¹  | [spec](../../specs/003-tasks/spec.md#us-0312--keep-my-tasks-private-could)            |
| US-03.13 | Keep tasks when a team is deleted | MUST     | [spec](../../specs/003-tasks/spec.md#us-0313--keep-tasks-when-a-team-is-deleted-must) |
| US-03.14 | See which tasks are overdue       | COULD    | [spec](../../specs/003-tasks/spec.md#us-0314--see-which-tasks-are-overdue-could)      |
| US-03.15 | Avoid overwriting a newer change  | COULD    | [spec](../../specs/003-tasks/spec.md#us-0315--avoid-overwriting-a-newer-change-could) |
| US-03.16 | Retry task creation safely        | COULD    | [spec](../../specs/003-tasks/spec.md#us-0316--retry-task-creation-safely-could)       |

¹ Ownership comes with authentication (EP-01, a COULD). Once EP-01 ships it is non-negotiable ([constitution VI.2](../../constitution.md#vi-security-by-default)), so every story is implemented owner-scoped from day one.

## Traceability to the brief

| Brief requirement                                           | Stories                        |
| ----------------------------------------------------------- | ------------------------------ |
| Task CRUD                                                   | US-03.1, 03.8, 03.9, 03.11     |
| Status `Pending / In progress / Done`                       | US-03.1, 03.9, 03.10           |
| A task belongs to zero or more teams                        | US-03.1, 03.9, 03.13           |
| Listing with `teamId`, `status`, `search`, sort, pagination | US-03.2 – 03.7                 |
| Team color shown as chip on tasks (data needed by the app)  | US-03.2, 03.8 (embedded teams) |
| Quick actions (change status, delete) on task detail        | US-03.10, 03.11                |
| Seeds (10 tasks)                                            | plan / `T-003-14`              |

## Success criteria

- 100 % of MUST acceptance criteria covered by ≥ 1 BDD scenario and ≥ 1 automated test.
- Task listing p95 < 100 ms locally on seeded data (and on a 10k-task synthetic owner in the k6 run, EP-06).
- Listing a page issues a **constant** number of database round-trips, independent of page size (no N+1).
- Status change round-trip leaves `completedAt` consistent with status in 100 % of transition-matrix tests.
- Domain layer: ≥ 90 % line coverage, mutation score ≥ 80 %.

## Dependencies

| Depends on                                                 | Why                                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| EP-01 / [001-auth](../../specs/001-auth/spec.md)           | Authenticated owner id on every request.                                                     |
| EP-02 / [002-teams](../../specs/002-teams/spec.md)         | `TeamDirectory` (existence + ownership + display data of teams) and the `TeamDeleted` event. |
| EP-07 / [007-ci-and-dx](../../specs/007-ci-and-dx/spec.md) | Shared envelope, error filter, idempotency/ETag infrastructure, seed runner.                 |

| Depended on by                 | Why                                                                    |
| ------------------------------ | ---------------------------------------------------------------------- |
| EP-04 Mobile Experience        | Task list, detail, form, chips, quick actions.                         |
| EP-05 Offline & Responsiveness | Optimistic status change relies on version tags and idempotent create. |
| EP-02 Team Management          | `taskCount` per team needs Task Management data.                       |

## Risks

| Risk                                                                        | Mitigation                                                                                      |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Embedding team data per task degrades into one lookup per task (N+1).       | Batch lookup per page; round-trip count asserted in an integration test.                        |
| Substring search slows down as data grows.                                  | Trigram index; search length capped at 100; measured with EXPLAIN and k6.                       |
| Offset pagination shows duplicates / skips when data changes between pages. | Documented trade-off (ADR-0006); deterministic tie-break by id; acceptable for a personal list. |
| Team deletion leaves tasks pointing at a deleted team.                      | Read side never shows deleted teams; idempotent unassign reaction; integration test.            |
| Scope creep from COULD items (concurrency, idempotency).                    | Separate tasks after all MUST tasks; optional headers so MUST flows never depend on them.       |
