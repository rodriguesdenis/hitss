# EP-05 — Offline & Responsiveness

- **Owner:** product-owner · **Status:** Draft · **Priority:** SHOULD · **Spec:** [005-offline-sync](../../specs/005-offline-sync/spec.md) · **Design:** [design-spec §6](../../design/design-spec.md#6-interaction-details)
- **Brief traceability:** brief differentials "offline-first" and "optimistic updates" — see [vision § SHOULD](../vision.md#should-briefs-differentials); vision problem 3 ("updating status must be instant, even offline") and success metric "status change perceived latency: instant, rollback on failure".

## Goal

Marina's changes feel instant and are never lost: she can read her tasks and teams, change status, create, edit and delete while on a flaky or absent connection, and the app reconciles with the server when it can.

## Business value

- The persona is "often on unreliable mobile networks" — offline capability turns dead time (elevator, subway, conference Wi-Fi) into usable time.
- Instant feedback is the vision's explicit success metric for status change.
- Safe, conflict-aware sync demonstrates senior-level understanding of distributed state — a key evaluator signal.

## Scope

- Persisted copy of the last-seen teams and tasks available on launch without network.
- Connectivity awareness (offline banner, back-online sync summary).
- Optimistic status change, delete, create and edit with rollback on rejection.
- Durable queue of changes made offline, surviving app restarts, replayed in order on reconnect.
- Safe replays (no duplicates), conflict detection and user-visible resolution (latest server version wins and the user is told).
- Pending-sync indicators per item and globally.

## Out of scope

- Offline sign-in or sign-up (a session must first be obtained online).
- Manual merge UI for conflicts (field-by-field); background sync while the app is closed.
- Offline full-text search beyond the already-loaded data.
- Multi-device real-time updates (push/websocket).

## User stories

| ID      | Title                                                  | Priority | Spec                                                                                                                         |
| ------- | ------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| US-05.1 | See my teams and tasks without a connection            | SHOULD   | [spec § US-05.1](../../specs/005-offline-sync/spec.md#us-051--see-my-teams-and-tasks-without-a-connection-should)            |
| US-05.2 | Know when I'm offline and when changes are pending     | SHOULD   | [spec § US-05.2](../../specs/005-offline-sync/spec.md#us-052--know-when-im-offline-and-when-changes-are-pending-should)      |
| US-05.3 | Change status instantly                                | SHOULD   | [spec § US-05.3](../../specs/005-offline-sync/spec.md#us-053--change-status-instantly-should)                                |
| US-05.4 | Delete instantly                                       | SHOULD   | [spec § US-05.4](../../specs/005-offline-sync/spec.md#us-054--delete-instantly-should)                                       |
| US-05.5 | Create and edit tasks while offline                    | SHOULD   | [spec § US-05.5](../../specs/005-offline-sync/spec.md#us-055--create-and-edit-tasks-while-offline-should)                    |
| US-05.6 | Offline changes survive restarts and sync on reconnect | SHOULD   | [spec § US-05.6](../../specs/005-offline-sync/spec.md#us-056--offline-changes-survive-restarts-and-sync-on-reconnect-should) |
| US-05.7 | Conflicts are resolved safely and explained            | SHOULD   | [spec § US-05.7](../../specs/005-offline-sync/spec.md#us-057--conflicts-are-resolved-safely-and-explained-should)            |

## Success criteria

- Status change is reflected in the UI in the same frame as the tap (no spinner), measured by component test asserting the new status before the server responds.
- 100 % of 005 acceptance criteria covered by automated tests; an E2E flow toggles connectivity, queues 3 changes, restarts the app and verifies they reach the server exactly once.
- Zero duplicated tasks after replaying a queued creation twice (idempotent replay).
- Every rollback or conflict produces a user-visible explanation.

## Dependencies

- EP-04 (screens, indicators placement, toasts) · EP-03 (quick status, concurrency `version`/`If-Match`, soft delete) · API idempotency keys and optimistic concurrency ([api-contracts.md](../../architecture/api-contracts.md#conventions)).
- ADR [0012](../../architecture/adr/archive/0012-offline-first-and-optimistic-updates.md), [0015](../../architecture/adr/archive/0015-optimistic-concurrency.md), [0019](../../architecture/adr/archive/0019-idempotency-keys.md).

## Risks

| Risk                                              | Impact                                                                               | Mitigation                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Only creation requests are idempotent server-side | A replayed edit/delete whose first attempt succeeded may report a conflict/not-found | Treat "not found" on delete as success; for edits refetch and compare before warning (spec BR-05.6); raised as open question |
| Items created offline have no server id           | Follow-up changes on them can't be sent yet                                          | Changes on an unsynced item wait for its creation (ordered queue), see spec BR-05.4                                          |
| Persisted data grows / becomes stale              | Storage use, misleading data                                                         | Cache max age and per-user buster; stale data marked by the offline banner                                                   |
| Session expires while offline                     | Queue rejected on reconnect                                                          | Queue kept, user asked to sign in again, then replayed (same user only)                                                      |
| Storage engine speed in Expo Go                   | Slow cold start                                                                      | Throttled writes; pluggable storage adapter (faster engine in dev builds)                                                    |
