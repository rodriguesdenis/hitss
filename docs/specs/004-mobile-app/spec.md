# 004 — Mobile app

- **Epic:** [EP-04 Mobile Experience](../../product/epics/EP-04-mobile-experience.md) · **Status:** Draft · **Priority:** MUST (US-04.1–04.9, 04.15, 04.16); COULD: sign-up UX (US-04.13), sort (US-04.14), theme, language, accessibility (US-04.10–04.12)
- **Design:** [design-spec.md](../../design/design-spec.md) · **Behavior:** [mobile-app.feature](mobile-app.feature) · **Plan:** [plan.md](plan.md) · **Tasks:** [tasks.md](tasks.md)

## Problem

Marina coordinates work across a few small teams from her phone, between meetings. She needs to see "what is pending for team X", mark things done quickly and capture new tasks before she forgets them. The API (specs 001–003) holds the data, but she has no way to use it on the move.

## Goals / Non-goals

**Goals**

- Every brief mobile screen: teams list with tap-to-filter, tasks list (global and per team), create/edit form with validation, task detail with quick actions (change status, delete), team color chips on tasks.
- Clear feedback on every screen (loading, empty, error with retry, success).
- Comfortable for everyone: light/dark theme, English and Brazilian Portuguese, WCAG 2.1 AA.

**Non-goals**

- Working without a connection, instant (pre-confirmation) feedback and the change queue — spec [005-offline-sync](../005-offline-sync/spec.md). This spec defines where those indicators live, not their behavior.
- Collaboration, notifications, attachments, password recovery, tablet/web layouts.

## User stories

### US-04.1 — Sign in and stay signed in (`MUST`, every API route requires authentication)

As Marina, I want to sign in with my email and password, so that only I can see and change my teams and tasks.

**Acceptance criteria**

- **AC-04.1.1** Given I am not signed in, when I open the app, then I see the sign-in screen and cannot reach any other screen.
- **AC-04.1.2** Given valid credentials, when I sign in, then I land on the tasks list; when I reopen the app later, I am still signed in.
- **AC-04.1.3** Given wrong credentials, when I sign in, then I stay on the sign-in screen and see "Incorrect email or password"; my password is not shown in clear text unless I choose to reveal it.
- **AC-04.1.6** Given my session has expired, when any action reaches the server, then I am taken to the sign-in screen with "Your session has expired. Please sign in again."
- **AC-04.1.7** Given I am signed in, then every request to the API carries the session cookie read from the authentication client (`authClient.getCookie()`) — the app has no browser cookie jar and never uses the bearer token (that is for cURL and API collections only).

### US-04.13 — Sign up (`COULD`)

As Marina, I want to create my own account, so that I can use the app without the demo account.

**Acceptance criteria**

- **AC-04.13.1** Given I fill name, a valid email and a password of 8–128 characters, when I sign up, then my account is created and I am signed in; an email already registered shows an error on the email field. _(was AC-04.1.4)_

### US-04.16 — Sign out (`MUST`, every API route requires authentication; 005 depends on it)

As Marina, I want to sign out, so that nobody using my phone afterwards can see or change my data.

**Acceptance criteria**

- **AC-04.16.1** Given I am signed in, when I sign out, then my session and all locally kept data are removed and I see the sign-in screen. _(was AC-04.1.5, then AC-04.13.2)_

### US-04.2 — Browse teams and open a team's tasks (`MUST`)

As Marina, I want to see my teams and tap one to see its tasks, so that I can focus on what concerns a single team.

**Acceptance criteria**

- **AC-04.2.1** Given I have teams, when I open the Teams tab, then I see each team's name, color, description (if any) and number of tasks, ordered by name.
- **AC-04.2.2** Given the teams list, when I tap a team, then I see a tasks list showing **only** tasks assigned to that team, titled with the team's name and color.
- **AC-04.2.3** Given I have more teams than fit in one page, when I scroll to the end, then more teams load until all are shown.
- **AC-04.2.4** Given I search teams by a term, when I stop typing, then only teams whose name contains the term (case-insensitive) are shown.

### US-04.3 — Create, edit and delete a team (`MUST`, brief: "CRUD de times … via API e interface")

As Marina, I want to manage my teams from the app, so that I can organize new work without another tool.

**Acceptance criteria**

- **AC-04.3.1** Given the team form, when I enter a name of 2–50 characters and pick a color, then the team is created and appears in the teams list.
- **AC-04.3.2** Given a name already used by another of my teams (ignoring case), when I save, then I see "You already have a team with this name." on the name field and nothing is saved.
- **AC-04.3.3** Given an existing team, when I change its name or color, then the teams list and every task chip of that team show the new name and color.
- **AC-04.3.4** Given an existing team, when I delete it and confirm, then it disappears from the list and its tasks remain, no longer showing that team's chip.
- **AC-04.3.5** Given the color picker, when I choose a preset or type a `#RRGGBB` value, then I see a live preview of the chip; an invalid value shows "Use a color like #6366F1".

### US-04.4 — Browse tasks globally and per team (`MUST`)

As Marina, I want a list of all my tasks and a list per team, so that I can see the whole picture or a single team's work.

**Acceptance criteria**

- **AC-04.4.1** Given I have tasks, when I open the Tasks tab, then I see all my tasks regardless of team (including tasks with no team), newest first, each with title, status, team chips and due date.
- **AC-04.4.2** Given a team's tasks list, then only tasks assigned to that team are shown, and a task assigned to several teams appears in each of those teams' lists.
- **AC-04.4.3** Given more tasks than one page, when I scroll near the end, then the next page loads automatically, until a "That's all" end marker is shown.
- **AC-04.4.4** Given any list, when I pull down, then the list reloads from the first page keeping my current filters.
- **AC-04.4.5** Given a task not Done whose due date is before today, then it is marked "Overdue" with text and icon, not color alone.
- **AC-04.4.6** Given I tap a task, then its detail opens.

### US-04.5 — Filter and search tasks (`MUST`, brief: "listagem suporta filtros teamId e status, search e paginação")

As Marina, I want to narrow tasks by status and text, so that I find the right task in seconds.

**Acceptance criteria**

- **AC-04.5.1** Given a tasks list (global or team), when I choose one status from a single-select control (All, Pending, In progress, Done), then only tasks with that status are shown (All = no status filter); combined with the team when in a team list.
- **AC-04.5.2** Given I type a search term, when I pause typing for a moment, then only tasks whose title or description contains the term are shown; clearing the term restores the list. Fast typing triggers a single search, not one per keystroke.
- **AC-04.5.4** Given filters that match nothing, then I see "No tasks match your filters" with a "Clear filters" action that restores the unfiltered list.
- **AC-04.5.5** Given I set filters on the global list and on a team list, then each list remembers its own filters while the app is running; after a restart or sign-out, lists start unfiltered.

### US-04.14 — Sort tasks (`COULD`)

As Marina, I want to change the order of my tasks, so that I see what matters first.

**Acceptance criteria**

- **AC-04.14.1** Given the sort options (newest, oldest, due date soonest with undated last, recently updated, title A–Z, status), when I choose one, then the list is reordered accordingly and the current sort is visible. _(was AC-04.5.3)_

### US-04.6 — Task detail with quick actions (`MUST`)

As Marina, I want to see a task's details and change its status or delete it right there, so that I can act on it in one tap.

**Acceptance criteria**

- **AC-04.6.1** Given a task, when I open its detail, then I see title, status, description, all its team chips, due date (with overdue marker), and created/updated/completed dates.
- **AC-04.6.2** Given the detail, when I choose a different status, then the new status is saved and is reflected in the detail and in every list where the task appears.
- **AC-04.6.3** Given the detail, when I choose the status the task already has, then nothing changes and nothing is sent.
- **AC-04.6.4** Given the detail, when I choose Delete, then I am asked to confirm; if I confirm, the task is deleted, I return to the list and it no longer appears in any list; if I cancel, nothing changes.
- **AC-04.6.5** Given the server rejects a status change or deletion, then the task shows its previous state and I see why.
- **AC-04.6.6** Given a task row in a list, when I long-press it, then I can change its status without opening the detail, with the same result as AC-04.6.2.
- **AC-04.6.7** Given the task was deleted elsewhere, when I open its detail, then I see "This task no longer exists." and a way back to the list.

### US-04.7 — Create and edit a task with validation (`MUST`)

As Marina, I want a form to capture or change a task, with clear validation, so that I never save incomplete or invalid tasks.

**Acceptance criteria**

- **AC-04.7.1** Given the form, when I enter a title of at least 3 characters (after trimming spaces) and save, then the task is created with status Pending unless I chose another, and appears at the top of the list.
- **AC-04.7.2** Given a title shorter than 3 characters (after trimming), when I save or leave the field, then I see "Title must be at least 3 characters" and nothing is saved.
- **AC-04.7.3** Given a title longer than 120 characters or a description longer than 2000, then the form prevents saving and explains the limit.
- **AC-04.7.4** Given the form, I can optionally set a description, status, a due date (past dates allowed with a hint) and assign 0 to 10 of my teams shown as colored chips; an 11th team cannot be selected.
- **AC-04.7.5** Given I open "New task" from a team's list, then that team is preselected.
- **AC-04.7.6** Given an existing task, when I edit and save, then the detail and lists show the new values; when the task was changed elsewhere meanwhile, I am told and can reload the latest version.
- **AC-04.7.7** Given unsaved changes, when I cancel, then I am asked whether to discard them.
- **AC-04.7.8** Given the server rejects the form (invalid field, unknown teams, too many teams), then the message appears next to the related field and my input is preserved.

### US-04.8 — Team color chips on tasks (`MUST`)

As Marina, I want each task to show colored chips of its teams, so that I recognize team ownership at a glance.

**Acceptance criteria**

- **AC-04.8.1** Given a task assigned to teams, then each team appears as a chip with the team's name on the team's color, in lists and in the detail.
- **AC-04.8.2** Given any team color, then the chip text is black or white, whichever is more readable (contrast at least 4.5:1), and a chip whose color is too close to the background gets an outline.
- **AC-04.8.3** Given a task with more than 3 teams, then lists show 3 chips and a "+N" marker; the detail shows all of them.
- **AC-04.8.4** Given a task without teams, then no chips are shown in lists and the detail says "No teams".
- **AC-04.8.5** Given a screen reader, then the chip group is read as "Teams: <names>".

### US-04.9 — Clear loading, empty, error and success feedback (`MUST`)

As Marina, I want to always know what the app is doing, so that I never wonder whether something worked.

**Acceptance criteria**

- **AC-04.9.1** Given data is loading for the first time, then I see placeholders shaped like the content, not a blank screen.
- **AC-04.9.2** Given there is nothing to show, then I see a message explaining why and the action to create the first item.
- **AC-04.9.3** Given loading fails, then I see a message explaining the failure (connection vs server) and a "Try again" action that retries; content already shown stays visible.
- **AC-04.9.4** Given I create, edit or delete something successfully, then I see a short confirmation message that disappears on its own and is announced to screen readers.
- **AC-04.9.5** Given any error returned by the server, then the message shown is the user-friendly text for that error in my language, never a technical code.
- **AC-04.9.6** Given I press a save button twice quickly, then the action happens once.

### US-04.15 — Mandated front-end stack (`MUST`, brief: "Formulários com validação", "React Query", "Estilização sem styled-components")

As the evaluator, I want the app's stack constraints to be verifiable, so that the brief's technical requirements are demonstrably met.

**Acceptance criteria**

- **AC-04.15.1** Given the mobile package, then a CI dependency check fails if `styled-components` (or `@emotion/*`-style CSS-in-JS runtime libraries equivalent to it) appears in its dependencies; styling uses NativeWind.
- **AC-04.15.2** Given every form in the app (sign-in, team, task), then it is built with react-hook-form and validated by a zod schema; a test or lint rule fails if a form screen does not use them.
- **AC-04.15.3** Given any data fetched from or sent to the API, then it goes through React Query (queries and mutations); a lint rule or test fails if a screen calls the API client directly, bypassing it.

### US-04.10 — Choose light, dark or system theme (`COULD`)

As Marina, I want the app to follow my phone's appearance or a theme I choose, so that it is comfortable day and night.

**Acceptance criteria**

- **AC-04.10.1** Given the default setting "System", then the app follows the phone's light/dark appearance, including changes while it is open.
- **AC-04.10.2** Given I choose Light or Dark in Settings, then the whole app switches immediately and keeps my choice after restart.

### US-04.11 — Use the app in English or Brazilian Portuguese (`COULD`)

As Marina, I want the app in my language, so that every label, message and date reads naturally.

**Acceptance criteria**

- **AC-04.11.1** Given my phone is in Portuguese, when I first open the app, then it is in Brazilian Portuguese; any other language falls back to English.
- **AC-04.11.2** Given I choose a language in Settings among `system` (default, follows the phone), `en` and `pt-BR`, then all text, including error messages and dates, switches immediately and the choice is kept after restart.

### US-04.12 — Accessible to assistive technologies (`COULD`)

As a user who relies on a screen reader, larger text or reduced motion, I want the app to work with my settings, so that I can manage tasks independently.

**Acceptance criteria**

- **AC-04.12.1** Every interactive element has an accessible name and role, and a touch area of at least 44×44 points.
- **AC-04.12.2** Text and essential graphics meet WCAG 2.1 AA contrast in both themes.
- **AC-04.12.3** With the largest system text size (up to 200 %), no text is cut off and every action remains reachable.
- **AC-04.12.4** With reduced motion enabled, no decorative animation plays.
- **AC-04.12.5** Status, selection, overdue and pending-sync are conveyed by text or icon in addition to color.

## Business rules

| ID       | Rule                                                                                                                                                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-04.1  | The client validates with the same limits as the server: task title 3–120 (trimmed), description ≤ 2000, 0–10 distinct teams; team name 2–50 (trimmed), color `#RRGGBB`, team description ≤ 280; password 8–128. The server remains the authority. |
| BR-04.2  | A team list shows the tasks assigned to that team only; the global list shows all tasks of the user, including those with no team.                                                                                                                 |
| BR-04.3  | Status transitions are free (any → any); choosing the current status is a no-op.                                                                                                                                                                   |
| BR-04.4  | Deletion of tasks and teams always requires explicit confirmation; deleting a team keeps its tasks and removes the team from them.                                                                                                                 |
| BR-04.5  | Chip text color = black or white by highest contrast with the team color; outline when chip-to-background contrast < 3:1.                                                                                                                          |
| BR-04.6  | Search waits for a pause in typing (300 ms) and uses the trimmed term (1–100 chars); empty term = no search filter.                                                                                                                                |
| BR-04.7  | Page size is 20; lists load the next page automatically near the end.                                                                                                                                                                              |
| BR-04.8  | Filters (status, search, sort) are kept per list (global list and each team list) for the running session; they reset on restart and sign-out. The team of a team list is part of the screen's address, so it can be opened directly.              |
| BR-04.9  | Server error codes are always mapped to localized, user-friendly messages; unknown codes use the generic message.                                                                                                                                  |
| BR-04.10 | Dates are calendar dates shown in the user's locale and never shifted by time zone.                                                                                                                                                                |

## Edge cases

- Team deleted elsewhere while I am viewing its tasks → "This team no longer exists." with a way back to Teams.
- Task opened through a link for a task that belongs to another user → "This task no longer exists." (same as not found; no existence leak).
- Task edited elsewhere while my form is open → on save, conflict message with reload option (AC-04.7.6).
- A selected team in the form was deleted elsewhere → it is removed from the selection with an explanation (AC-04.7.8).
- Very long titles/team names → truncated with ellipsis in lists; full text in detail and in screen-reader labels.
- Emoji and accents in titles and search terms work as typed.
- Rate limited → message with wait time; no automatic hammering.
- API unreachable at launch (wrong address on a physical device) → connection error state with retry.
- Device clock wrong → overdue is taken from the server's computed flag, not the device clock.

## Out of scope

- Offline behavior and instant feedback (spec 005).
- Swipe-to-delete in lists, bulk actions, drag-and-drop ordering.
- Team sharing, assignees, comments, attachments, notifications, password reset, email verification.

## Open questions

| #       | Question                                                                                     | Proposed answer                                                                              |
| ------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| OQ-04.1 | Should Undo be offered after delete?                                                         | No — the API has no restore; confirm dialog instead. Revisit if a restore endpoint is added. |
| OQ-04.2 | Should status filter allow multiple statuses at once (API supports a list)?                  | Single-select in the UI for simplicity; multi-select is a later enhancement.                 |
| OQ-04.3 | Exact sign-in/sign-up error codes from the identity provider are not in the API error table. | Confirm with spec 001 and map them to `auth.invalidCredentials` / `auth.emailTaken`.         |
