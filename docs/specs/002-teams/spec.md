# 002 — Team management

- **Epic:** [EP-02 Team Management](../../product/epics/EP-02-team-management.md) · **Status:** Draft · **Priority:** MUST (some stories `COULD`, tagged per story)

## Problem

Marina's work spans several small teams (Mobile, Backend, Design). She needs named, color-coded teams she can create, find, rename, recolor and remove, so she can filter tasks by team and recognize a team at a glance by its color chip. The brief requires team CRUD and a listing that returns pagination metadata.

## Goals / Non-goals

**Goals**

- Full team lifecycle: create, view, list, update (full replacement), delete (archive).
- Listing with pagination metadata, search by name and sorting.
- Clear, enforced naming and color rules, so chips stay readable and teams are never ambiguous.
- Deleting a team never deletes work: its tasks stay and are only unassigned from it.
- Edits from two devices never silently overwrite each other when the client asks for protection, and retried creations never create duplicates.

**Non-goals**

- Sharing teams with other users, members, roles.
- Restoring a deleted team.
- Partial updates.

## User stories

### US-02.1 — Create a team (`MUST`)

As Marina, I want to create a team with a name, a color and an optional description, so that I can group and recognize related tasks.

**Acceptance criteria**

- **AC-02.1.1** Given valid input, when I create a team, then it is created and returned with: a new id, the trimmed name, the color in upper case, the description (or none), `taskCount` 0, `version` 1, and creation and update timestamps. The response gives the new team's location and its version tag.
- **AC-02.1.2** Given a name, when I create a team, then it is accepted only if its length after trimming is 2–50 characters (1 and 51 rejected, 2 and 50 accepted). A rejected name produces a validation error that names the `name` field, and nothing is created.
- **AC-02.1.3** Given a color, when I create a team, then it is accepted only in the form `#RRGGBB` with hexadecimal digits in any letter case. It is stored and returned in upper case. Anything else (`#FFF`, `7C3AED`, `#7C3AED0`, `#GGGGGG`, `red`, empty) is a validation error naming `colorHex`.
- **AC-02.1.4** Given a description, when I create a team, then it is optional and accepted up to 280 characters after trimming (281 rejected). An empty or blank description is stored as no description.
- **AC-02.1.5** Given I already have an active team named "Mobile", when I create a team named "mobile", "MOBILE" or " Mobile ", then creation is rejected with `409 TEAM_NAME_ALREADY_EXISTS` and no team is created.
- **AC-02.1.6** Given another user has a team named "Mobile", when I create a team named "Mobile", then it is created (names are unique per user only).
- **AC-02.1.7** Given I deleted my team named "Mobile", when I create a new team named "Mobile", then it is created (deleted teams do not reserve names).
- **AC-02.1.8** Given a request containing a field other than `name`, `colorHex` and `description` (e.g. `id`, `ownerId`, `version`, `taskCount`), when I create a team, then it is rejected with a validation error naming that field.
- **AC-02.1.9** Given two create requests with the same name for the same user arrive at the same time, then exactly one team is created and the other request receives `409 TEAM_NAME_ALREADY_EXISTS`.

### US-02.2 — List teams with pagination metadata (`MUST`)

As Marina, I want to list my teams a page at a time, with the total count, so that the app can show them and load more as I scroll.

**Acceptance criteria**

- **AC-02.2.1** Given I have teams and another user has teams, when I list teams, then I get only my active teams, plus `meta` with `total`, `limit`, `offset` and `hasNextPage`.
- **AC-02.2.2** Given I pass no paging parameters, when I list teams, then `limit` is 20, `offset` is 0, and teams are ordered newest first.
- **AC-02.2.3** Given I have 25 teams, when I request `limit=10`, then offsets 0 and 10 report `hasNextPage` true, and offset 20 returns 5 teams with `hasNextPage` false. `total` is 25 on every page.
- **AC-02.2.4** Given I have 3 teams, when I request an offset of 3 or more, then I get an empty page, `total` 3 and `hasNextPage` false (not an error).
- **AC-02.2.5** Given paging parameters, when `limit` is outside 1–100, `offset` is negative, or either is not an integer, then the request is rejected with a validation error naming the parameter.
- **AC-02.2.6** Given I have no teams, when I list teams, then I get an empty list with `total` 0 and `hasNextPage` false.
- **AC-02.2.7** Given I deleted a team, when I list teams, then it is neither returned nor counted in `total`.
- **AC-02.2.8** Given teams created at the same instant, when I page through all teams with any supported order, then every team appears exactly once across pages (ties are broken deterministically).
- **AC-02.2.9** Given an unknown query parameter, when I list teams, then the request is rejected with a validation error naming it.

### US-02.3 — Search teams by name (`MUST`, from the brief's suggested `GET /api/teams?…&search=`)

As Marina, I want to find a team by typing part of its name, so that I can reach it quickly when I have many.

**Acceptance criteria**

- **AC-02.3.1** Given teams "Mobile", "Backend" and "Mobile QA", when I search "mob", then I get "Mobile" and "Mobile QA" (case-insensitive substring of the name), and `total` is 2.
- **AC-02.3.2** Given a search term with surrounding spaces, then it is trimmed before matching. A term that is blank after trimming is treated as no search. A term longer than 100 characters is a validation error.
- **AC-02.3.3** Given a team "50% Growth" and a team "Team_A", when I search `%` or `_`, then only the team whose name literally contains that character is returned (no wildcard semantics).
- **AC-02.3.4** Given no team matches, when I search, then I get an empty list with `total` 0.
- **AC-02.3.5** Given a search term, then it only matches my teams and never another user's.

### US-02.4 — Sort teams (`COULD`)

As Marina, I want to sort teams by name or by when they were created or updated, so that I can scan the list in the order that suits me.

**Acceptance criteria**

- **AC-02.4.1** Given teams "beta", "Alpha" and "Gamma", when I sort by `name`, then they come back "Alpha", "beta", "Gamma" (alphabetical, case-insensitive). With `-name` they come back in reverse.
- **AC-02.4.2** Given teams created or updated at different times, when I sort by `createdAt`, `-createdAt`, `updatedAt` or `-updatedAt`, then they come back in that order.
- **AC-02.4.3** Given an unsupported sort value (e.g. `color`, `taskCount`, `--name`, empty), when I list teams, then the request is rejected with a validation error naming `sort`.
- **AC-02.4.4** Given search, sort and paging together, when I list teams, then the order is applied to the search results before paging, and `total` counts all matches.

### US-02.5 — View a team (`MUST`)

As Marina, I want to open one team, so that I can see its details and current version before editing it.

**Acceptance criteria**

- **AC-02.5.1** Given my team exists, when I get it by id, then I receive it, including `taskCount` and `version`, together with a version tag that matches `version`.
- **AC-02.5.2** Given no team has that id, when I get it, then the response is `404 TEAM_NOT_FOUND`.
- **AC-02.5.3** Given the id belongs to another user's team, when I get it, then the response is identical to AC-02.5.2.
- **AC-02.5.4** Given I deleted the team, when I get it, then the response is identical to AC-02.5.2.
- **AC-02.5.5** Given an id that is not a valid UUID, when I get it, then the request is rejected with a validation error naming `id`.

### US-02.6 — Update a team (`MUST`)

As Marina, I want to rename, recolor or re-describe a team, so that it keeps reflecting how I organize work.

**Acceptance criteria**

- **AC-02.6.1** Given my team at version _n_, when I replace it with a valid name, color and description, then the new values are stored and returned, `version` becomes _n+1_, `updatedAt` advances, `createdAt` is unchanged, and the new version tag is returned.
- **AC-02.6.2** Given invalid values, when I update, then the same rules as creation apply (name 2–50 after trim, `#RRGGBB` color, description ≤ 280, unknown fields rejected), and the team is unchanged.
- **AC-02.6.3** Given my team has a description, when I update it without a description, then the description is cleared (full replacement).
- **AC-02.6.4** Given I have teams "Mobile" and "Backend", when I rename "Backend" to "mobile", then the update is rejected with `409 TEAM_NAME_ALREADY_EXISTS` and "Backend" is unchanged.
- **AC-02.6.5** Given my team "mobile", when I rename it to "Mobile" (only the letter case changes), then the update succeeds.
- **AC-02.6.6** Given the id is unknown, belongs to another user, or belongs to a deleted team, when I update it, then the response is `404 TEAM_NOT_FOUND` and no team is changed.
- **AC-02.6.7** Given my team, when I submit exactly its current values (after trimming and normalization), then it is returned unchanged: `version` and `updatedAt` stay the same.

### US-02.7 — Delete a team (`MUST`)

As Marina, I want to delete a team I no longer use, without losing its tasks, so that my team list stays clean.

**Acceptance criteria**

- **AC-02.7.1** Given my team, when I delete it, then the response has no content, and afterwards the team is not returned by get (404) or by the list, and it is not counted in `total`.
- **AC-02.7.2** Given tasks assigned to the team (some also assigned to other teams), when I delete the team, then every task still exists, none of them lists the deleted team, and their other team assignments are untouched.
- **AC-02.7.3** Given the id is unknown, belongs to another user, or was already deleted, when I delete it, then the response is `404 TEAM_NOT_FOUND` and nothing changes.
- **AC-02.7.4** Given a team deletion, then the removal of the team and the unassignment of its tasks happen together. A failure leaves both the team and its assignments as they were.

### US-02.8 — See how many tasks a team has (`COULD`)

As Marina, I want each team to show how many tasks it has, so that I can see where work piles up.

**Acceptance criteria**

- **AC-02.8.1** Given a team with tasks assigned, when I list teams or get the team, then `taskCount` equals the number of my active (not deleted) tasks assigned to it, whatever their status.
- **AC-02.8.2** Given a task assigned to the team, when that task is deleted or unassigned from the team, then the team's `taskCount` decreases by one.
- **AC-02.8.3** Given a newly created team, then its `taskCount` is 0.

### US-02.9 — Edit safely when another device changed the team (`COULD`)

As Marina, using the app on two devices, I want an edit based on an outdated copy to be refused instead of silently overwriting newer changes, so that I never lose edits.

**Acceptance criteria**

- **AC-02.9.1** Given my team at version _n_, when I update or delete it with a precondition naming version _n_, then the operation succeeds.
- **AC-02.9.2** Given my team is at version _n+1_, when I update it with a precondition naming version _n_, then it is rejected with `412 PRECONDITION_FAILED`, the error details include the current version _n+1_, and the team is unchanged.
- **AC-02.9.3** Given my team is at version _n+1_, when I delete it with a precondition naming version _n_, then it is rejected with `412 PRECONDITION_FAILED` and the team is not deleted.
- **AC-02.9.4** Given no precondition, when I update or delete, then the operation proceeds against the current version (preconditions are optional).
- **AC-02.9.5** Given two updates with a precondition naming the same current version arrive at the same time, then exactly one succeeds and the other receives `412 PRECONDITION_FAILED`.
- **AC-02.9.6** Given a precondition that is not a recognizable version tag, when I update or delete, then it is rejected with `412 PRECONDITION_FAILED` (it cannot match).
- **AC-02.9.7** Given the team is not found (unknown, foreign or deleted), when I send any precondition, then the response is `404 TEAM_NOT_FOUND` (not found wins over precondition).

### US-02.10 — Retry team creation safely (`COULD`)

As Marina on a flaky network, I want a resent "create team" request not to create a second team, so that retries are harmless.

**Acceptance criteria**

- **AC-02.10.1** Given I created a team with idempotency key _K_, when I resend the same request with key _K_ within 24 hours, then I receive the original response (same status, same team id and body), and only one team exists. The response indicates it is a replay.
- **AC-02.10.2** Given I created a team with key _K_, when I send a different body with key _K_ within 24 hours, then it is rejected with `422 IDEMPOTENCY_KEY_REUSED` and nothing is created.
- **AC-02.10.3** Given an idempotency key that is not a UUID, when I create a team, then the request is rejected with a validation error naming the key.
- **AC-02.10.4** Given Rafael used key _K_, when I create a team with key _K_, then my request is processed independently (keys are scoped per user).
- **AC-02.10.5** Given my request with key _K_ was rejected (validation or name conflict), when I retry with key _K_ and a corrected body, then it is processed normally (only successful outcomes are remembered).
- **AC-02.10.6** Given more than 24 hours passed since key _K_ was used, when I resend with key _K_, then it is processed as a new request.
- **AC-02.10.7** Given no idempotency key, when I create a team, then it is processed normally (the key is optional).

## Business rules

| ID       | Rule                                                                                                                                                                                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-02.1  | **Name:** trimmed; 2–50 characters after trimming, counted as Unicode characters (code points, not bytes; a single-code-point emoji counts as one); inner spaces preserved.                                                                                             |
| BR-02.2  | **Name uniqueness:** unique per owner among active teams, compared case-insensitively. Other users' teams and deleted teams do not count. Guaranteed even under concurrent requests.                                                                                    |
| BR-02.3  | **Color:** `#RRGGBB` hexadecimal; normalized to upper case on input.                                                                                                                                                                                                    |
| BR-02.4  | **Description:** optional; trimmed; ≤ 280 characters; empty or blank → none.                                                                                                                                                                                            |
| BR-02.5  | **Update is a full replacement** of `name`, `colorHex` and `description`; an omitted description clears it.                                                                                                                                                             |
| BR-02.6  | **Version** starts at 1 and increases by exactly 1 on every effective change. A no-op update does not change it.                                                                                                                                                        |
| BR-02.7  | **Delete is an archive:** the team becomes invisible everywhere (get, list, counts, task chips, task filters), its tasks remain, and its task assignments are removed in the same unit of work.                                                                         |
| BR-02.8  | **Ownership:** every operation is scoped to the signed-in user. Unknown, foreign and deleted teams are indistinguishable (`404 TEAM_NOT_FOUND`).                                                                                                                        |
| BR-02.9  | **`taskCount`** = number of the owner's active tasks assigned to the team. Derived, never client-set.                                                                                                                                                                   |
| BR-02.10 | **Listing:** `limit` 1–100 (default 20), `offset` ≥ 0 (default 0), `search` 1–100 chars after trim (blank → ignored), `sort` ∈ `name`, `createdAt`, `updatedAt` with optional `-` (default `-createdAt`); ties broken by id; `hasNextPage = offset + returned < total`. |
| BR-02.11 | **Preconditions:** optional on update and delete; a mismatch → `412 PRECONDITION_FAILED` with the current version; not-found takes precedence.                                                                                                                          |
| BR-02.12 | **Idempotency:** optional key (UUID) on create, scoped per user, remembered for 24 h, successful outcomes only; same key + different body → `422 IDEMPOTENCY_KEY_REUSED`.                                                                                               |

## Edge cases

| Case                                                                       | Expected                                                                                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Name with only spaces                                                      | Validation error (empty after trim).                                                                                    |
| Name `"  ab  "`                                                            | Accepted, stored `"ab"` (2 chars after trim).                                                                           |
| Name of 50 characters including accented letters or an emoji               | Accepted (counted as characters, not bytes).                                                                            |
| Name in a non-Latin script differing only by case (`"Ωmega"` vs `"ωmega"`) | Same name (case-insensitive applies to all scripts).                                                                    |
| Names differing only by accents (`"Équipe"` vs `"equipe"`)                 | Distinct names (accents are significant; only letter case is ignored).                                                  |
| `colorHex` lower case `#7c3aed`                                            | Accepted, returned `#7C3AED`.                                                                                           |
| `description: null` explicitly                                             | Same as omitted → none.                                                                                                 |
| `limit=100` / `limit=101`                                                  | 100 accepted / 101 rejected.                                                                                            |
| `offset` far beyond `total`                                                | Empty page, correct `total`.                                                                                            |
| `search=%25` (a literal `%`)                                               | Literal match only.                                                                                                     |
| Repeated query parameter (`limit=10&limit=20`)                             | Validation error.                                                                                                       |
| Deleting a team while a task referencing it is being edited elsewhere      | The task edit that tries to (re)assign the deleted team fails as unknown team (see 003).                                |
| Idempotent replay after the team was renamed or deleted                    | The original creation response is replayed unchanged (it describes the outcome of that request, not the current state). |

## Out of scope

- Restoring deleted teams and purging archived ones (production improvement).
- `PATCH` partial updates, bulk operations.
- Team members, sharing, permissions.
- Teams list screen and team chip rendering (in [004-mobile-app](../004-mobile-app/spec.md)), filtering tasks by team (in [003-tasks](../003-tasks/spec.md)).

## Open questions

| ID     | Question                                                                                                                                                             | Proposed answer                                                                                                                                                                                                                                                                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q-02.1 | Two requests with the same idempotency key arriving concurrently (the first still in progress): what does the second receive? The contract defines no code for this. | The second waits briefly for the first to finish and then receives the replayed response (or, if the first failed, is processed itself). Only if the wait exceeds a few seconds is it rejected with `409` and a new code `IDEMPOTENCY_KEY_IN_PROGRESS`, which needs adding to the error codes. In all cases at most one team is created per key. |
| Q-02.2 | Should creation and update responses also carry the version tag? (The contract only states single-resource responses carry it.)                                      | Yes, all single-team responses (`GET`, `POST`, `PUT`) carry it.                                                                                                                                                                                                                                                                                  |
| Q-02.3 | Is a soft-deleted team's name reusable immediately?                                                                                                                  | Yes (AC-02.1.7), consistent with the partial unique index in the data model.                                                                                                                                                                                                                                                                     |
