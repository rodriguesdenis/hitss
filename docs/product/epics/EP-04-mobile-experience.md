# EP-04 — Mobile Experience

- **Owner:** product-owner · **Status:** Draft · **Spec:** [004-mobile-app](../../specs/004-mobile-app/spec.md) · **Design:** [design-spec](../../design/design-spec.md)
- **Brief traceability:** "Mobile screens" (teams list with tap-to-filter, tasks list global and per team, create/edit form with title ≥ 3 validation, task detail with quick actions, team color chip on tasks) and "Front-end stack" (server-state management, no styled-components, form library + schema validation) — see [vision § MUST](../vision.md#must-from-the-brief).

## Goal

Give Marina a fast, clear phone app to see her tasks across teams, narrow them down to one team, capture new tasks and update status in a couple of taps.

## Business value

- It is the **only** user-facing surface of the product: without it, the API delivers no value to the persona.
- It is where evaluators judge "minimal UX", component quality and front-end architecture — the brief's explicit evaluation axes.
- Color-coded teams and one-tap status changes address vision problems 1 and 2 (work spans teams; finding the right tasks fast on a small screen).

## Scope

- Sign in, sign up, sign out and protected navigation (consumes EP-01).
- Teams list (tap → tasks of that team), team create/edit/delete.
- Tasks list, global and per team, with status filter, search, sort, incremental loading and pull to refresh.
- Task detail with quick actions (change status, delete with confirmation).
- Create/edit task form with validation (title 3–120, description ≤ 2000, status, due date, 0–10 teams).
- Team color chips on tasks, readable on any color.
- Loading, empty, error, success feedback on every screen.
- Theme (light / dark / system), language (English / Brazilian Portuguese), accessibility (WCAG 2.1 AA).

## Out of scope

- Offline persistence, optimistic updates and the change queue → [EP-05](EP-05-offline-and-responsiveness.md) (EP-04 shows the indicators' placement only).
- Collaboration, notifications, attachments, comments (vision out of scope).
- Web or tablet-specific layouts; app store publishing.
- Password reset, email verification, social login.

## User stories

| ID       | Title                                            | Priority | Spec                                                                                                                                                                       |
| -------- | ------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-04.1  | Sign in and stay signed in                       | MUST     | [spec § US-04.1](../../specs/004-mobile-app/spec.md#us-041--sign-in-and-stay-signed-in-must-every-api-route-requires-authentication)                                       |
| US-04.2  | Browse teams and open a team's tasks             | MUST     | [spec § US-04.2](../../specs/004-mobile-app/spec.md#us-042--browse-teams-and-open-a-teams-tasks-must)                                                                      |
| US-04.3  | Create, edit and delete a team                   | MUST     | [spec § US-04.3](../../specs/004-mobile-app/spec.md#us-043--create-edit-and-delete-a-team-must-brief-crud-de-times--via-api-e-interface)                                   |
| US-04.4  | Browse tasks globally and per team               | MUST     | [spec § US-04.4](../../specs/004-mobile-app/spec.md#us-044--browse-tasks-globally-and-per-team-must)                                                                       |
| US-04.5  | Filter and search tasks                          | MUST     | [spec § US-04.5](../../specs/004-mobile-app/spec.md#us-045--filter-and-search-tasks-must-brief-listagem-suporta-filtros-teamid-e-status-search-e-paginação)                |
| US-04.6  | Task detail with quick actions                   | MUST     | [spec § US-04.6](../../specs/004-mobile-app/spec.md#us-046--task-detail-with-quick-actions-must)                                                                           |
| US-04.7  | Create and edit a task with validation           | MUST     | [spec § US-04.7](../../specs/004-mobile-app/spec.md#us-047--create-and-edit-a-task-with-validation-must)                                                                   |
| US-04.8  | Team color chips on tasks                        | MUST     | [spec § US-04.8](../../specs/004-mobile-app/spec.md#us-048--team-color-chips-on-tasks-must)                                                                                |
| US-04.9  | Clear loading, empty, error and success feedback | MUST     | [spec § US-04.9](../../specs/004-mobile-app/spec.md#us-049--clear-loading-empty-error-and-success-feedback-must)                                                           |
| US-04.10 | Choose light, dark or system theme               | COULD    | [spec § US-04.10](../../specs/004-mobile-app/spec.md#us-0410--choose-light-dark-or-system-theme-could)                                                                     |
| US-04.11 | Use the app in English or Brazilian Portuguese   | Dropped  | pt-BR only ([spec](../../specs/004-mobile-app/spec.md#out-of-scope))                                                                                                       |
| US-04.12 | Accessible to assistive technologies             | COULD    | [spec § US-04.12](../../specs/004-mobile-app/spec.md#us-0412--accessible-to-assistive-technologies-could)                                                                  |
| US-04.13 | Sign up                                          | COULD    | [spec § US-04.13](../../specs/004-mobile-app/spec.md#us-0413--sign-up-could)                                                                                               |
| US-04.14 | Sort tasks                                       | COULD    | [spec § US-04.14](../../specs/004-mobile-app/spec.md#us-0414--sort-tasks-could)                                                                                            |
| US-04.15 | Mandated front-end stack (verifiable)            | MUST     | [spec § US-04.15](../../specs/004-mobile-app/spec.md#us-0415--mandated-front-end-stack-must-brief-formulários-com-validação-react-query-estilização-sem-styled-components) |
| US-04.16 | Sign out                                         | MUST     | [spec § US-04.16](../../specs/004-mobile-app/spec.md#us-0416--sign-out-must-every-api-route-requires-authentication-005-depends-on-it)                                     |

Priority notes: US-04.9 is tagged MUST because the brief evaluates "minimal UX" and a screen that hangs or fails silently does not meet it. The brief demands "CRUD de times e tarefas funcional via API e interface" and "listagem suporta filtros teamId e status, search e paginação", so in-app team CRUD (US-04.3) and the status filter + search (US-04.5) are MUST; sort (US-04.14) stays COULD. Sign-in (US-04.1) is MUST because every API route requires authentication; sign-out (US-04.16) is MUST, the sign-up screen (US-04.13) is COULD (the demo account covers evaluation).

## Success criteria

- 100 % of the MUST acceptance criteria of 004 (54 of 65; the other 11 are COULD) covered by at least one automated test (component or E2E), tagged with the AC id.
- A first-time evaluator can, in Expo Go against the seeded API: sign in, open a team, see only its tasks, mark one Done, create a task with two teams and delete it — in under 2 minutes without guidance.
- Every screen in the [design spec](../../design/design-spec.md#7-screen-state-matrix-checklist-for-component-tests) state matrix has a component test per state.
- Automated accessibility checks show no missing labels on interactive elements; contrast of all token pairs ≥ 4.5:1.
- Lint, typecheck and tests green in CI for the mobile package.

## Dependencies

- EP-01 Identity & Access (sessions) · EP-02 Team Management · EP-03 Task Management (filters, pagination, quick status).
- EP-07 (generated API client, CI). Contract: [api-contracts.md](../../architecture/api-contracts.md).
- Design: [design-spec.md](../../design/design-spec.md).

## Risks

| Risk                                             | Impact                      | Mitigation                                                                    |
| ------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------- |
| Device cannot reach the API on `localhost`       | Evaluator can't run the app | Documented LAN-IP / tunnel setup and a clear connection-error state           |
| Contract drift between API and app               | Runtime errors              | Generated client from the API's published contract; drift check in CI (EP-07) |
| Scope creep from COULD items (theme, i18n, a11y) | MUST screens late           | MUST stories scheduled first in tasks; COULD tasks independent                |
| Arbitrary team colors unreadable                 | Accessibility failure       | Deterministic black/white text rule + outline rule (design spec §3)           |
| Expo Go limits native modules                    | Features blocked            | Only Expo Go–compatible dependencies (see ADR-0009)                           |
