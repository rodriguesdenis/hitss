# 005 — Offline sync

- **Epic:** [EP-05 Offline & Responsiveness](../../product/epics/EP-05-offline-and-responsiveness.md) · **Status:** Draft · **Priority:** MUST (raised from SHOULD, user decision 2026-10-25; milestone M5)
- **Design:** [design-spec §5–§6](../../design/design-spec.md#6-interaction-details) · **Behavior:** [offline-sync.feature](offline-sync.feature) · **Plan:** [plan.md](plan.md) · **Tasks:** [tasks.md](tasks.md)
- **Builds on:** [004-mobile-app](../004-mobile-app/spec.md) screens. The API is last write wins with no idempotency keys ([ADR-0020](../../architecture/adr/0020-simplify-architecture-for-the-hiring-test.md)). UI copy is quoted in pt-BR.

## Problem

Marina is "often on unreliable mobile networks". Today every action waits for the server: a status change shows a spinner, a lost connection blocks her entirely, and anything she tries while offline is lost. The vision commits to instant status changes with rollback on failure.

## Goals / Non-goals

**Goals**

- Read last-seen teams and tasks with no connection, including right after launching the app.
- Every change (status, delete, create, edit) is visible immediately and confirmed or reverted later.
- Changes made offline are kept across app restarts and sent automatically, in order, when the connection returns.
- Changes that can no longer be applied (deleted elsewhere, invalid) are discarded and explained; otherwise the last write wins.

**Non-goals**

- Signing in or up without a connection.
- Conflict detection or merge of edits made elsewhere (last write wins).
- Syncing while the app is closed (background tasks), real-time updates from other devices.
- Searching data that was never loaded on this device.

## User stories

### US-05.1 — See my teams and tasks without a connection (`MUST`)

As Marina, I want the app to show the teams and tasks I last saw even when I'm offline, so that I can check my work anywhere.

**Acceptance criteria**

- **AC-05.1.1** Given I have viewed my tasks and teams online, when I open the app without a connection (including after closing it), then I see them as last loaded, without a loading placeholder.
- **AC-05.1.2** Given I'm offline, when I open a task I have seen before, then its detail is shown.
- **AC-05.1.3** Given I'm offline, when I open a list or detail I have never loaded, then I see the offline error state with "Tentar novamente", and it loads automatically when the connection returns.
- **AC-05.1.4** Given saved data older than 24 hours, when I open the app, then it is not shown as current; fresh data is loaded when online.
- **AC-05.1.5** Given I sign out, then no data of mine remains on the device; another user signing in on the same device never sees it.

### US-05.2 — Know when I'm offline and when changes are pending (`MUST`)

As Marina, I want to see when I'm offline and which changes haven't reached the server, so that I trust what I see.

**Acceptance criteria**

- **AC-05.2.1** Given I lose connectivity, then within a second I see "Você está offline. As alterações serão sincronizadas ao reconectar." until the connection returns.
- **AC-05.2.2** Given a change not yet confirmed by the server, then the affected task or team shows "Sincronização pendente", and the Tasks tab shows a pending indicator.
- **AC-05.2.3** Given pending changes, when the connection returns, then I see "De volta online — sincronizando N alterações…" followed by "Todas as alterações sincronizadas" once they are all confirmed; the pending markers disappear.
- **AC-05.2.4** Given pending changes, then Settings shows how many are waiting.

### US-05.3 — Change status instantly (`MUST`)

As Marina, I want a status change to show immediately, so that marking work done never makes me wait.

**Acceptance criteria**

- **AC-05.3.1** Given online or offline, when I change a task's status, then the new status appears immediately in the detail and in every list where the task appears, before the server answers.
- **AC-05.3.2** Given the server confirms, then the task keeps the new status and the pending marker disappears.
- **AC-05.3.3** Given the server rejects the change, then the task returns to its previous status everywhere and I see why.
- **AC-05.3.4** Given I change the status several times quickly (or offline), then the final status on the server is the last one I chose.
- **AC-05.3.5** Given a list filtered by status, when I change a task to a different status, then it leaves that filtered list immediately.

### US-05.4 — Delete instantly (`MUST`)

As Marina, I want a deleted task to disappear immediately, so that my lists reflect my decision at once.

**Acceptance criteria**

- **AC-05.4.1** Given I confirm deleting a task (online or offline), then it disappears immediately from every list and the detail closes.
- **AC-05.4.2** Given the server rejects the deletion, then the task reappears where it was and I see why.
- **AC-05.4.3** Given the task was already deleted elsewhere, then my deletion is considered done, without an error.
- **AC-05.4.4** Given I delete a team (online or offline), then it disappears immediately and its chips disappear from tasks; on rejection everything is restored.

### US-05.5 — Create and edit tasks while offline (`MUST`)

As Marina, I want to capture and edit tasks without a connection, so that I don't forget them.

**Acceptance criteria**

- **AC-05.5.1** Given I create a task (online or offline), then it appears at the top of the relevant lists immediately, marked "Sincronização pendente", and the form closes with "Salvo. Será sincronizado quando você estiver online." when offline.
- **AC-05.5.2** Given I edit a task (online or offline), then the detail and lists show the new values immediately, marked "Sincronização pendente".
- **AC-05.5.3** Given a task created offline, when I open it, change its status, edit or delete it before it syncs, then those changes are applied after its creation, in order.
- **AC-05.5.4** Given a creation is confirmed, then the task keeps its place and content, and anything opened on it (detail) keeps working.
- **AC-05.5.5** Given the server rejects a creation or edit (e.g. invalid data or a team that no longer exists), then the change is reverted, discarded and I see "Não foi possível salvar “<title>”: <reason>".
- **AC-05.5.6** Given I create or edit a team offline, then the same rules apply, and tasks assigned to that new team while offline are synced after it.

### US-05.6 — Offline changes survive restarts and sync on reconnect (`MUST`)

As Marina, I want my offline changes to be kept even if I close the app, so that nothing I did is lost.

**Acceptance criteria**

- **AC-05.6.1** Given pending changes, when I close and reopen the app while still offline, then they are still shown with "Sincronização pendente".
- **AC-05.6.2** Given pending changes, when the connection returns (in the same session or after a restart), then they are sent automatically in the order I made them, without any action from me.
- **AC-05.6.3** Given a status change, edit or deletion is sent again because its answer was lost, then the result is the same as sending it once. A creation whose answer was lost may be created twice (accepted, OQ-05.1).
- **AC-05.6.4** Given the server is temporarily failing, then pending changes are retried later, not discarded.
- **AC-05.6.5** Given queued changes belong to one user, then (a) they are never sent with another user's session: if a different user signs in, they are discarded before any request is made; (b) after my session has expired, nothing is sent until the same user signs in again, and then the pending changes are sent; (c) when a replayed request receives a `401`, the queue is kept intact (nothing is dropped) and replay resumes after the same user signs in again.
- **AC-05.6.6** Given pending changes, when I sign out, then I am warned that they will be discarded and can cancel.

### US-05.7 — Replay outcomes are explained (`MUST`)

As Marina, I want to know when a change I made offline could not be applied, so that I never believe something was saved when it was not.

**Acceptance criteria**

- **AC-05.7.1** Given a pending edit or status change of a task that was changed elsewhere, when it is sent, then my change is applied (last write wins) and no message is shown.
- **AC-05.7.2** Given a pending edit or status change of a task that was deleted elsewhere (`404`), when it is sent, then the change is discarded, the task is removed from my lists and I see the warning "“<title>” foi excluída em outro lugar."
- **AC-05.7.3** Given a pending change whose effect is already present on the server (e.g. its first attempt succeeded but the answer was lost), then it is treated as successful, with no message.
- **AC-05.7.4** Given several pending changes to the same task made by me, then they do not conflict with each other.
- **AC-05.7.5** Given a change is discarded, then the remaining pending changes continue to sync.

## Business rules

| ID       | Rule                                                                                                                                                                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-05.1  | Saved data belongs to the signed-in user, is discarded on sign-out or when another user signs in, and is not shown when older than 24 hours or saved by an incompatible app version.                                                                                              |
| BR-05.2  | Pending changes are sent one at a time in the order they were made (single lane), so later changes always see the result of earlier ones.                                                                                                                                         |
| BR-05.3  | A queued change leaves the queue only when the server confirms it or rejects it permanently. Status changes, edits and deletions are safe to resend; creations are not (no idempotency keys, OQ-05.1).                                                                            |
| BR-05.4  | A task or team created offline has a temporary identity; changes referring to it are sent after its creation and use its definitive identity.                                                                                                                                     |
| BR-05.5  | **Last write wins** (ADR-0020): the API does not detect concurrent edits, so a replayed change overwrites changes made elsewhere.                                                                                                                                                 |
| BR-05.6  | A change whose intended effect already exists on the server is a success (idempotent outcome), including deleting something already deleted.                                                                                                                                      |
| BR-05.7  | A replay answered `404` (except a deletion) or `422`/`400` is reverted, discarded and explained with a pt-BR warning toast; it is not retried. Connection problems, `429` and temporary server failures are retried with increasing delays; nothing is discarded because of them. |
| BR-05.8  | A change shows on screen immediately; "Sincronização pendente" is shown until the server confirms it.                                                                                                                                                                             |
| BR-05.9  | Sign-in and sign-up require a connection.                                                                                                                                                                                                                                         |
| BR-05.10 | When the connection returns, pending changes are sent **before** lists are refreshed, so refreshed data reflects them.                                                                                                                                                            |

## Edge cases

- Status changed twice offline (Pendente → Concluída → Em andamento) → server ends Em andamento (AC-05.7.4).
- Create offline then delete offline before sync → both sent in order; the task never appears afterwards.
- Edit offline a task that another device deleted → removed + warning, change discarded (AC-05.7.2).
- Assign a task offline to a team another device deleted → creation/edit rejected for unknown teams → reverted with reason (AC-05.5.5). (Proposed refinement: retry without the missing team — open question.)
- App killed in the middle of sending → on next launch the change is resent; safe for status, edit and delete (BR-05.3/BR-05.6); a creation may duplicate (OQ-05.1).
- Connectivity flapping → banner does not flicker faster than once per second; queue continues where it stopped.
- Wi-Fi without internet (captive portal) → treated as offline when internet is known unreachable; otherwise requests fail and are retried.
- Rate limited during replay → wait for the indicated time, then continue.
- Very large number of pending changes (e.g. 100) → all kept and sent; UI remains responsive.

## Out of scope

- Conflict detection, merge UI, manual retry per change (all changes retry automatically).
- Background sync with the app closed; push or live updates.
- Encrypting the saved data at rest beyond the platform's app sandbox (noted as production improvement).

## Open questions

| #       | Question                                                                                            | Proposed answer                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| OQ-05.1 | A creation resent after a lost answer can create a duplicate. Should the API dedupe creations?      | Accepted for this scope (ADR-0020). Either an `Idempotency-Key` on `POST` or OQ-05.2 would fix it. |
| OQ-05.2 | Could the API accept a client-generated id on creation?                                             | Would remove temporary identities (BR-05.4) entirely; proposed as a future contract change.        |
| OQ-05.3 | When a creation fails only because a team no longer exists, should the app retry without that team? | Proposed: no for now (revert + explain); revisit after usage.                                      |
| OQ-05.4 | Saved data retention of 24 hours — enough for the persona (offline over a weekend)?                 | Keep 24 h as decided; consider 7 days after usage feedback (configuration only).                   |
