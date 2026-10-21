# 003 — Tasks

- **Epic:** [EP-03 Task Management](../../product/epics/EP-03-task-management.md) · **Status:** Draft · **Priority:** MUST
- **Behavior:** [tasks.feature](tasks.feature) · **Plan:** [plan.md](plan.md) · **Tasks:** [tasks.md](tasks.md)
- **Language:** terms in **bold** are from the [ubiquitous language](../../architecture/domain-model.md#ubiquitous-language).

## Problem

Marina's work spans several teams, and a single piece of work often concerns more than one of them. She needs one place to capture work, see it from the angle of any team, find it quickly by status or text on a small screen, and move it forward in one action — without other people's data ever leaking into her view.

## Goals / Non-goals

| Goals                                                                                                          | Non-goals                                                  |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Full **task** lifecycle: create, view, edit, change **status**, delete (**archive**).                          | Assigning tasks to people, sharing, comments, attachments. |
| **Assign** a task to zero or more of the owner's **teams**; show each team's name and **color** with the task. | Sub-tasks, priorities, reminders, recurring tasks.         |
| Find tasks by team, status (one or many), text; sort; paginate with metadata.                                  | Relevance ranking, multi-field sort, cursor pagination.    |
| Free status lifecycle with a recorded completion time.                                                         | Workflow rules (e.g. "must be In progress before Done").   |
| Owner isolation; safe concurrent edits and retries (COULD).                                                    | Restoring deleted tasks, bulk edits.                       |

## Definitions

| Term                 | Meaning in this spec                                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Task view**        | The representation of a task returned by every operation: id, title, description, status, due date, completion time, overdue flag, teams (id, name, color), version, created and updated times. |
| **Today**            | The current calendar date in UTC (see [open question Q1](#open-questions)).                                                                                                                     |
| **Version tag**      | An opaque marker of a task's current version, returned with every single-task response.                                                                                                         |
| **Validation error** | Error code `VALIDATION_FAILED`, listing each offending field.                                                                                                                                   |
| **Not found**        | Error code `TASK_NOT_FOUND`. Used identically for "never existed", "deleted" and "belongs to someone else".                                                                                     |

## User stories

### US-03.1 — Create a task (`MUST`)

As Marina, I want to capture a task with a title and, optionally, a description, status, due date and teams, so that I don't forget work and it shows up in the right teams.

**Acceptance criteria**

- **AC-03.1.1** Given only a valid title, when I create a task, then it is created with status **Pending**, no description, no due date, no completion time, no teams, version 1, created/updated time = now, and I receive its task view and its location.
- **AC-03.1.2** The title is trimmed; a trimmed length of 3–120 characters is accepted; shorter (including blank), longer or missing → validation error on `title`; nothing is created.
- **AC-03.1.3** The description is optional and trimmed; blank becomes "no description"; more than 2000 characters → validation error on `description`.
- **AC-03.1.4** The status is optional; `PENDING`, `IN_PROGRESS` and `DONE` are accepted; any other value (including lower case) → validation error. Creating directly as **Done** sets the completion time to now.
- **AC-03.1.5** The due date is optional; it must be a real calendar date in `YYYY-MM-DD` form; past dates are accepted; anything else (impossible date, other format, date-time) → validation error on `dueDate`.
- **AC-03.1.6** Teams are given as a list of 0–10 distinct team ids; the task view embeds each assigned team's id, name and color. Duplicate or malformed ids → validation error; more than 10 → `TOO_MANY_TEAMS`; any id that is not one of my existing teams → `UNKNOWN_TEAMS` listing exactly the offending ids. In every error case nothing is created.
- **AC-03.1.7** Fields outside the contract (e.g. `id`, `ownerId`, `owner_id`, `userId`, `owner` as an object, `version`, `completedAt`, `updatedAt`, `deletedAt`, `__proto__`, `constructor`) → validation error naming the field; nothing is created. The same applies on edit (AC-03.9.3).
- **AC-03.1.8** A title or description containing a control character (Unicode category `Cc`, other than a line break in the description) → validation error on that field; nothing is created.

### US-03.2 — List my tasks (`MUST`)

As Marina, I want to see all my tasks in one list, so that I have a global view of my work.

- **AC-03.2.1** Given no parameters, when I list tasks, then I receive my non-deleted tasks, newest created first, at most 20, plus pagination metadata (`total`, `limit`, `offset`, `hasNextPage`).
- **AC-03.2.2** Every item is a full task view (same shape as US-03.8), including embedded teams.
- **AC-03.2.3** Deleted tasks and other users' tasks never appear, whatever the parameters.
- **AC-03.2.4** Given I have no tasks, the list is empty and `total` is 0.
- **AC-03.2.5** Embedded teams are ordered by name (case-insensitive); deleted teams are never embedded.

### US-03.3 — Filter tasks by team (`MUST`)

As Marina, I want to see only the tasks of one team, so that I can answer "what is going on in team X".

- **AC-03.3.1** Given a team id of mine, the list contains only tasks assigned to that team; a task assigned to several teams appears with **all** its teams embedded.
- **AC-03.3.2** A well-formed team id that is unknown, deleted, another user's, or has no tasks → empty list with `total` 0 (not an error).
- **AC-03.3.3** A malformed team id → validation error on `teamId`.

### US-03.4 — Filter tasks by status (`MUST`)

As Marina, I want to filter by one or several statuses, so that I can focus on what is still open.

- **AC-03.4.1** A single status returns only tasks with that status.
- **AC-03.4.2** A comma-separated list returns tasks having any of the listed statuses; repeated values are tolerated.
- **AC-03.4.3** An unknown value anywhere in the list, a lower-case value or an empty value → validation error on `status`.
- **AC-03.4.4** Team, status and search filters combine with AND (a task must satisfy all of them); values within the status list combine with OR.

### US-03.5 — Search tasks by text (`MUST`)

As Marina, I want to type a word and find matching tasks, so that I find a task without scrolling.

- **AC-03.5.1** A task matches when its title **or** its description contains the term, ignoring case.
- **AC-03.5.2** The term is trimmed; 1–100 characters are accepted; blank or longer → validation error on `search`.
- **AC-03.5.3** Characters are matched literally (e.g. `%`, `_`, `\` have no special meaning).
- **AC-03.5.4** No match → empty list with `total` 0.

### US-03.6 — Sort tasks (`MUST`)

As Marina, I want to choose the order of the list, so that I can see what is due first or what changed last.

- **AC-03.6.1** Sortable fields: `createdAt`, `updatedAt`, `dueDate`, `title`, `status`; `field` is ascending, `-field` descending; default `-createdAt`.
- **AC-03.6.2** `title` sorts alphabetically ignoring case; `status` sorts in lifecycle order Pending → In progress → Done (reversed when descending).
- **AC-03.6.3** With `dueDate`, tasks without a due date come last in **both** directions.
- **AC-03.6.4** Ties are broken by task id in the same direction, so the same request always returns the same order and pages never overlap while data is unchanged.
- **AC-03.6.5** An unknown field, several fields or a malformed value → validation error on `sort`.

### US-03.7 — Paginate tasks (`MUST`)

As Marina, I want the list to load in pages, so that it is fast on a mobile network.

- **AC-03.7.1** `limit` is 1–100 (default 20); `offset` is ≥ 0 (default 0).
- **AC-03.7.2** `meta.total` is the number of tasks matching the filters (not the page size); `meta.limit` and `meta.offset` echo the effective values; `meta.hasNextPage` is true iff `offset + items returned < total`.
- **AC-03.7.3** An offset at or beyond `total` returns an empty page with the correct `total` and `hasNextPage` false.
- **AC-03.7.4** Non-integer or out-of-range `limit` / `offset` → validation error on that field.
- **AC-03.7.5** Walking all pages of an unchanged list returns every matching task exactly once.

### US-03.8 — View a task (`MUST`)

As Marina, I want to open a task and see everything about it, so that I can decide what to do next.

- **AC-03.8.1** Given one of my tasks, when I view it, I receive its task view (with its teams' names and colors for chips, completion time, overdue flag, version) and its version tag.
- **AC-03.8.2** An unknown or deleted task id → not found.
- **AC-03.8.3** A malformed task id → validation error on `id`.

### US-03.9 — Edit a task (`MUST`)

As Marina, I want to change a task's title, description, status, due date and teams, so that it reflects reality.

- **AC-03.9.1** Given a full replacement (title, status, teams required; description and due date optional), the task is updated, its version increases by 1, its updated time becomes now and I receive the new task view.
- **AC-03.9.2** An omitted description or due date is cleared; an empty team list unassigns the task from all teams; the new team list fully replaces the old one.
- **AC-03.9.3** All create rules apply (AC-03.1.2 – AC-03.1.8); a missing `title`, `status` or `teamIds` → validation error; nothing is changed on any error.
- **AC-03.9.4** A status change made through an edit follows the completion rules of US-03.10.
- **AC-03.9.5** A replacement identical to the current state (team order ignored) changes nothing: same version, same updated time.
- **AC-03.9.6** Id, owner and created time never change; an unknown or deleted task → not found.

### US-03.10 — Change a task's status quickly (`MUST`)

As Marina, I want to change only the status of a task in one action, so that I can mark progress between meetings.

- **AC-03.10.1** Any status can change to any other status (all six transitions are allowed); the task's version increases by 1 and its updated time becomes now.
- **AC-03.10.2** Entering **Done** sets the completion time to now; leaving **Done** (**reopen**) clears it; moving between Pending and In progress keeps it empty.
- **AC-03.10.3** Changing to the current status is a no-op: success, same version, same updated time, same completion time (a Done task keeps its original completion time).
- **AC-03.10.4** A missing or unknown status, or any other field in the request → validation error.
- **AC-03.10.5** Title, description, due date and teams are untouched.
- **AC-03.10.6** An unknown or deleted task → not found.

### US-03.11 — Delete a task (`MUST`)

As Marina, I want to delete a task I no longer need, so that my lists stay relevant.

- **AC-03.11.1** Given one of my tasks, when I delete it, the operation succeeds with no content; afterwards the task cannot be viewed, edited, status-changed or found in any list.
- **AC-03.11.2** Deleting an unknown or already deleted task → not found.
- **AC-03.11.3** A deleted task no longer counts towards its teams' task counts.

### US-03.12 — Keep my tasks private (`MUST`, [constitution VI](../../constitution.md))

As Marina, I want my tasks to be invisible to anyone else, so that my work stays private.

- **AC-03.12.1** Viewing, editing, changing status of or deleting another user's task → not found, and that task is unchanged.
- **AC-03.12.2** Another user's tasks never appear in my lists, whatever the filters.
- **AC-03.12.3** Assigning another user's team to my task (create or edit) → `UNKNOWN_TEAMS` with that id.
- **AC-03.12.4** Filtering by another user's team → empty list.
- **AC-03.12.5** Any task operation without a valid session → `UNAUTHENTICATED` ([001-auth](../001-auth/spec.md)).
- **AC-03.12.6** A task's owner is always the signed-in user; no request field can set it (AC-03.1.7).

### US-03.13 — Keep tasks when a team is deleted (`MUST`)

As Marina, I want my tasks to survive when I delete a team, so that I don't lose work by reorganizing teams.

- **AC-03.13.1** After a team is deleted, every task that was assigned to it still exists, no longer shows that team, and keeps its other teams.
- **AC-03.13.2** A task whose only team was deleted appears with no teams; its title, status, due date and completion time are unchanged.
- **AC-03.13.3** Filtering by the deleted team returns an empty list.
- **AC-03.13.4** Each affected task's version increases by 1, so an edit based on the old version is detected (US-03.15).

### US-03.14 — See which tasks are overdue (`COULD`)

As Marina, I want overdue tasks flagged, so that I notice late work at a glance.

- **AC-03.14.1** A task is **overdue** iff it has a due date before **today** and its status is not **Done**.
- **AC-03.14.2** A task due today, a task without due date and a Done task with a past due date are not overdue.
- **AC-03.14.3** The flag is derived on every read: reopening a Done task with a past due date makes it overdue; the passing of a day makes a task overdue without any change to it.

### US-03.15 — Avoid overwriting a newer change (`COULD`)

As Marina, using the app on two devices, I want a stale edit to be rejected, so that I don't silently overwrite a newer change.

- **AC-03.15.1** Every single-task response carries the task's version tag.
- **AC-03.15.2** Edit, status change and delete accept an optional expected version tag; when it matches, the operation proceeds.
- **AC-03.15.3** When it does not match (or is malformed), the operation fails with `PRECONDITION_FAILED` including the current version, and nothing changes.
- **AC-03.15.4** Without an expected version tag, the operation proceeds (last write wins).
- **AC-03.15.5** Another user's task (or an unknown or deleted one) with any expected version tag on edit, status change or delete → not found (not found wins over the precondition).

### US-03.16 — Retry task creation safely (`COULD`)

As Marina, on a flaky network, I want retrying a create not to produce duplicates, so that my list stays clean.

- **AC-03.16.1** A create sent again with the same idempotency key and the same content within 24 hours returns the original response; only one task exists.
- **AC-03.16.2** The same key with different content → `IDEMPOTENCY_KEY_REUSED`; nothing is created.
- **AC-03.16.3** Keys are per user: another user sending the same key creates their own task.
- **AC-03.16.4** A malformed key (not a UUID) → validation error.
- **AC-03.16.5** After 24 hours the key is forgotten; reusing it creates a new task.
- **AC-03.16.6** Two requests with the same key and body at the same time → exactly one task is created; the other gets the `201` replay or an immediate `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` with `Retry-After: 1`.
- **AC-03.16.7** Another user's in-flight request with the same key never blocks or rejects mine.
- **AC-03.16.8** A key first used to create a team (`POST /teams`) and then sent to create a task → `422 IDEMPOTENCY_KEY_REUSED`; nothing is created.

## Business rules

| ID       | Rule                                                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-03.1  | Title: trimmed, 3–120 characters; control characters (`\p{Cc}`) rejected.                                                                                                        |
| BR-03.2  | Description: optional, trimmed, ≤ 2000 characters; blank is stored as "none".                                                                                                    |
| BR-03.3  | Status ∈ {Pending, In progress, Done}; default Pending.                                                                                                                          |
| BR-03.4  | Transitions are free: any status → any other status. Same status → no-op (no new version, no event).                                                                             |
| BR-03.5  | Completion time is set to now when entering Done and cleared when leaving Done; it is never set by the client.                                                                   |
| BR-03.6  | Due date: optional calendar date (no time); past dates allowed.                                                                                                                  |
| BR-03.7  | A task has 0–10 distinct teams, each an existing, non-deleted team of the same owner. The list is replaced as a whole.                                                           |
| BR-03.8  | When checks fail for several reasons, the order is: request validation → team count (`TOO_MANY_TEAMS`) → team existence (`UNKNOWN_TEAMS`) → version tag (`PRECONDITION_FAILED`). |
| BR-03.9  | Overdue = due date before today (UTC) and status ≠ Done. Derived, never stored.                                                                                                  |
| BR-03.10 | Every read and write is scoped to the owner; others' tasks behave as non-existent.                                                                                               |
| BR-03.11 | Delete is an archive: the task disappears from every read and write; there is no restore.                                                                                        |
| BR-03.12 | Every successful change increases the version by 1 and sets the updated time to now; a no-op changes neither.                                                                    |
| BR-03.13 | Deleting a team unassigns it from all its tasks; tasks are never deleted as a consequence.                                                                                       |
| BR-03.14 | Listing defaults: `sort=-createdAt`, `limit=20`, `offset=0`; tie-break by id; due-date nulls last.                                                                               |

## Edge cases

| Case                                                         | Expected                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Title `"  ab  "` (2 chars after trim)                        | Validation error.                                                 |
| Title of 120 characters surrounded by spaces                 | Accepted, stored trimmed.                                         |
| `dueDate` `2026-02-29` / `2028-02-29`                        | Rejected (not a leap year) / accepted.                            |
| `teamIds` with the same id twice                             | Validation error (not silently de-duplicated).                    |
| 11 team ids, some unknown                                    | `TOO_MANY_TEAMS` (count checked first, BR-03.8).                  |
| Status change to the current status with a stale version tag | `PRECONDITION_FAILED` (precondition is checked before the no-op). |
| Search term `100%`                                           | Matches only text containing the literal `100%`.                  |
| `status=PENDING,PENDING`                                     | Same as `status=PENDING`.                                         |
| `offset` far beyond `total`                                  | Empty page, correct total.                                        |
| Task re-marked Done                                          | Keeps its original completion time.                               |
| Team deleted while a task edit with that team is in flight   | Edit fails with `UNKNOWN_TEAMS` if it commits after the deletion. |

## Out of scope

People assignment, collaboration, notifications, comments, attachments, sub-tasks, priorities, reminders, restore of deleted tasks, bulk operations, multi-field sort, cursor pagination, relevance ranking, user time zones for "today", mobile screens (004) and offline queueing (005).

## Open questions

| #   | Question                                                                          | Current decision                                                                                                       |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Q1  | Which time zone defines "today" for overdue?                                      | UTC for v1; per-user time zone is a production improvement.                                                            |
| Q2  | Should a blank `search` be ignored instead of rejected?                           | Rejected (contract says 1–100 chars); the app omits the parameter when blank.                                          |
| Q3  | What happens when two requests with the same idempotency key arrive concurrently? | Resolved (ADR-0019): replay `201` or immediate `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` + `Retry-After: 1`; never blocks. |
| Q4  | Should team unassignment on team deletion bump the task version (AC-03.13.4)?     | Yes — the task view changed; needed for correct offline sync.                                                          |
| Q5  | Malformed task id in the path: validation error (400) or not found (404)?         | Validation error, field `id`.                                                                                          |
