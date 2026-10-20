# 004 — Tasks

Ordered; each task is one PR (Conventional Commits, [ADR-0017](../../architecture/adr/0017-conventional-commits-and-atomic-prs.md)). Test-first: every task lands with the tests for the scenarios it covers. Offline/optimistic behavior is in [005 tasks](../005-offline-sync/tasks.md).

| ID       | Task                                                          | Depends on | Size | Branch                        |
| -------- | ------------------------------------------------------------- | ---------- | ---- | ----------------------------- |
| T-004-01 | Scaffold Expo app in the monorepo                             | —          | S    | `chore/004-scaffold-expo-app` |
| T-004-02 | Add NativeWind, design tokens and the `@apply` catalog        | 01         | M    | `feat/004-design-tokens`      |
| T-004-03 | Add i18n and theme providers with the preferences store       | 02         | M    | `feat/004-i18n-theme`         |
| T-004-04 | Generate the API client with orval and the fetch mutator      | 01         | M    | `feat/004-api-client`         |
| T-004-05 | Wire QueryClient, query key factory and test harness          | 03, 04     | S    | `feat/004-query-client`       |
| T-004-06 | Add auth client and the protected-route gate                  | 05         | S    | `feat/004-auth-gate`          |
| T-004-07 | Build sign-in and sign-up screens                             | 06, 08     | M    | `feat/004-auth-screens`       |
| T-004-08 | Build UI kit primitives                                       | 02, 03     | M    | `feat/004-ui-primitives`      |
| T-004-09 | Build UI kit feedback and selection components                | 08         | M    | `feat/004-ui-feedback`        |
| T-004-10 | Add tab navigation shell and Settings screen                  | 06, 09     | M    | `feat/004-tabs-settings`      |
| T-004-11 | Build the Teams list                                          | 10         | M    | `feat/004-teams-list`         |
| T-004-12 | Build the team form (create, edit, delete)                    | 11         | M    | `feat/004-team-form`          |
| T-004-13 | Build the Tasks list (global and per team)                    | 11         | M    | `feat/004-tasks-list`         |
| T-004-14 | Add task filters: status, search, sort                        | 13         | M    | `feat/004-task-filters`       |
| T-004-15 | Build task detail with quick actions                          | 13         | M    | `feat/004-task-detail`        |
| T-004-16 | Build the create/edit task form                               | 15, 12     | M    | `feat/004-task-form`          |
| T-004-17 | Harden error handling, empty/loading states and accessibility | 16         | M    | `fix/004-states-a11y`         |
| T-004-18 | Add Maestro E2E flows for the main journeys                   | 17         | S    | `test/004-maestro-flows`      |
| T-004-19 | Add Storybook for the UI kit (COULD)                          | 09         | S    | `chore/004-storybook`         |
| T-004-20 | Document running the app on a device                          | 07         | S    | `docs/004-mobile-readme`      |

## T-004-01 — Scaffold Expo app in the monorepo

- **Goal:** an empty Expo Router app `@hitss/mobile` that boots in Expo Go and participates in Turborepo tasks.
- **Changes:** `apps/mobile/` from the Expo Router template (latest stable SDK, TypeScript strict, `noUncheckedIndexedAccess`), `app.config.ts` (name, slug, scheme `teamstasks`, `experiments.typedRoutes`), `src/lib/env.ts` (zod-validated `EXPO_PUBLIC_API_URL`), `.env.example`, `metro.config.js` monorepo-aware (watchFolders, `node-linker` compatibility), ESLint (`eslint-config-expo`) + Prettier, `jest.config.js` (`jest-expo` preset), `package.json` scripts `start`, `lint`, `typecheck`, `test`; root `turbo.json` pipeline entries.
- **Covers:** foundation (no scenario).
- **Done when:** `pnpm --filter @hitss/mobile start` opens a placeholder screen in Expo Go on iOS and Android; `lint typecheck test` pass in CI; missing `EXPO_PUBLIC_API_URL` fails fast with a readable message (unit test).

## T-004-02 — Add NativeWind, design tokens and the `@apply` catalog

- **Goal:** design spec §1–§2 available as Tailwind theme and semantic classes.
- **Changes:** `tailwind.config.js` (design §1.6), `global.css` (catalog §2), `babel.config.js` / `metro.config.js` NativeWind setup, `nativewind-env.d.ts`, `src/theme/tokens.ts` (same values for non-className consumers), `src/theme/contrast.ts` (`contrastingText`, `needsOutline`, `contrastRatio`).
- **Covers:** @AC-04.8.2, @AC-04.12.2 (unit).
- **Done when:** table-driven tests for every preset in design §1.3 and the feature's chip examples pass; a test asserts all text token pairs in §1.1/§1.2 are ≥ 4.5:1; a smoke screen renders each catalog class in light and dark.

## T-004-03 — Add i18n and theme providers with the preferences store

- **Goal:** language and theme selectable, defaulting to the system.
- **Changes:** `src/i18n/` (i18next init, `en.json`, `pt-BR.json` with all design §9 keys), `src/providers/{I18nProvider,ThemeProvider}.tsx`, `src/features/settings/store/preferences.ts` (Zustand + immer + persist), `src/lib/storage/` (`StorageAdapter` interface + AsyncStorage implementation, reused by 005), `src/lib/dates.ts`.
- **Covers:** @AC-04.10.1, @AC-04.10.2, @AC-04.11.1, @AC-04.11.2 (unit/component).
- **Done when:** locale key-parity test passes; `pt`/`pt-PT` → pt-BR, others → en; preference persists (store test with in-memory adapter); dates formatted per locale and never shifted by time zone (tests across TZ env).

## T-004-04 — Generate the API client with orval and the fetch mutator

- **Goal:** typed React Query hooks and zod schemas from the API's OpenAPI; one place for auth headers and error mapping.
- **Changes:** `packages/api-client/` (`package.json` `@hitss/api-client`, `orval.config.ts` per plan, `src/mutator.ts` `customFetch` + `configureApiClient`, `src/errors.ts` `ApiError`/`errorMessageKey`/`fieldErrors`, `src/index.ts`), Turborepo `generate` task depending on the API's OpenAPI export.
- **Covers:** @AC-04.9.5 (unit), @AC-04.1.6 (unit: 401 hook).
- **Done when:** generation is reproducible from `openapi.json`; mutator unit tests cover 2xx envelope, 204, each error code in the contract table, unknown code fallback, network failure, timeout, `Retry-After`, 401 callback, `If-Match`/`Idempotency-Key` passthrough.

## T-004-05 — Wire QueryClient, query key factory and test harness

- **Goal:** server-state infrastructure and a reusable test render.
- **Changes:** `src/lib/query-client.ts` (defaults per plan, `focusManager` ↔ `AppState`), `src/lib/query-keys.ts` (`qk`, mutation keys), `src/providers/QueryProvider.tsx`, `src/providers/AppProviders.tsx`, `test/setup.ts` (MSW server, RNTL matchers), `test/handlers/*.ts` (teams/tasks fixtures mirroring the feature Background), `test/renderWithProviders.tsx`.
- **Covers:** infrastructure.
- **Done when:** a sample component test fetches through a generated hook against MSW; key-factory unit tests; invalidation helpers (`invalidateAfter(mutationKey)`) unit-tested against the plan's table.

## T-004-06 — Add auth client and the protected-route gate

- **Goal:** only signed-in users reach `(app)`; session restored on launch without a sign-in flash.
- **Changes:** `src/lib/auth-client.ts`, `app/_layout.tsx` (splash hold), `app/(auth)/_layout.tsx` and `app/(app)/_layout.tsx` (redirects per ADR-0009), `configureApiClient` wiring (`getCookie`, `onUnauthenticated` → clear cache, sign out locally).
- **Covers:** @AC-04.1.1, @AC-04.1.6.
- **Done when:** router tests (`renderRouter`) show unauthenticated → sign-in, authenticated → tasks, 401 during a query → sign-in with the session-expired message.

## T-004-07 — Build sign-in and sign-up screens

- **Goal:** design S1/S2 with validation and mapped errors.
- **Changes:** `src/features/auth/screens/{SignInScreen,SignUpScreen}.tsx`, `features/auth/hooks/{useSignIn,useSignUp}.ts` (rhf + zod), routes `app/(auth)/sign-in.tsx`, `sign-up.tsx`.
- **Covers:** @AC-04.1.2, @AC-04.1.3, @AC-04.1.4.
- **Done when:** component tests: success navigates; wrong credentials banner; password boundaries 7/8/128/129; email taken on field; submitting disables inputs; offline disables submit with hint; show/hide password labelled.

## T-004-08 — Build UI kit primitives

- **Goal:** lean, accessible building blocks using only catalog classes.
- **Changes:** `src/components/ui/{Button,IconButton,Fab,Input,TextArea,Field,SearchInput,Skeleton,EmptyState,ErrorState,Screen}.tsx` + tests.
- **Covers:** @AC-04.12.1, @AC-04.12.4 (Skeleton respects reduce motion).
- **Done when:** each component has role/label/state tests, min 44 pt target assertion, light/dark class assertions; Skeleton is static when `AccessibilityInfo.isReduceMotionEnabled` is true.

## T-004-09 — Build UI kit feedback and selection components

- **Goal:** the remaining shared components of the design.
- **Changes:** `src/components/ui/{TeamChip,TeamChipGroup,StatusBadge,SegmentedControl,Toast,Toaster,Sheet,ConfirmDialog,DatePickerField,OfflineBanner}.tsx`, `src/lib/toast-store.ts`.
- **Covers:** @AC-04.8.1, @AC-04.8.2, @AC-04.8.3, @AC-04.8.5, @AC-04.9.4, @AC-04.12.5.
- **Done when:** TeamChip text/outline follow the rule for the feature's examples in both themes; group shows 3 + `+N` (list variant) or all (detail variant) and announces "Teams: …"; StatusBadge always renders icon + label; Toast auto-hides (fake timers), is announced, supports an action; ConfirmDialog focuses Cancel first.

## T-004-10 — Add tab navigation shell and Settings screen

- **Goal:** Tasks / Teams / Settings tabs; Settings per design S5.
- **Changes:** `app/(app)/(tabs)/_layout.tsx`, placeholder tab routes, `src/features/settings/screens/SettingsScreen.tsx` (account card, theme segmented, language radio list, sign out), `src/theme/navigation-theme.ts`.
- **Covers:** @AC-04.1.5, @AC-04.10.2, @AC-04.11.2.
- **Done when:** tests: theme and language apply immediately; sign out clears cache + filter store and shows sign-in; tab labels translated; tab icons labelled.

## T-004-11 — Build the Teams list

- **Goal:** design S4 with tap → team tasks.
- **Changes:** `src/features/teams/screens/TeamsListScreen.tsx`, `features/teams/components/{TeamCard,TeamCardSkeleton,TeamOptionsSheet}.tsx`, `features/teams/hooks/useTeamsList.ts` (infinite, `sort=name`, debounced search), route `app/(app)/(tabs)/teams/index.tsx`.
- **Covers:** @AC-04.2.1, @AC-04.2.2 (navigation), @AC-04.2.3, @AC-04.2.4, @AC-04.9.1, @AC-04.9.2, @AC-04.9.3.
- **Done when:** component tests for loading skeleton, empty, empty-with-search, error + retry, list with counts in name order, infinite scroll requests `offset=20`, pull-to-refresh, tap navigates to `/tasks?teamId=<id>`.

## T-004-12 — Build the team form (create, edit, delete)

- **Goal:** design S10/S11.
- **Changes:** `src/features/teams/screens/TeamFormScreen.tsx`, `features/teams/components/{ColorSwatchGrid,ChipPreview}.tsx`, `features/teams/hooks/{useTeamForm,useTeamMutations}.ts` (mutation keys from `qk`, invalidation per plan), routes `app/(app)/teams/new.tsx`, `app/(app)/teams/[id]/edit.tsx`; delete from options sheet and form.
- **Covers:** @AC-04.3.1, @AC-04.3.2, @AC-04.3.3, @AC-04.3.4, @AC-04.3.5.
- **Done when:** name boundaries 1/2/50/51; duplicate name error on field from `TEAM_NAME_ALREADY_EXISTS`; hex validation + uppercase; preview chip uses the contrast rule; update invalidates `tasks.all`; delete requires confirmation and tasks remain (MSW state); conflict dialog on `PRECONDITION_FAILED`.

## T-004-13 — Build the Tasks list (global and per team)

- **Goal:** design S3/S6 list with infinite scroll and pull to refresh (filters come in T-004-14).
- **Changes:** `src/features/tasks/screens/TasksListScreen.tsx` (prop `teamId?` from the `?teamId=` search param), `features/tasks/components/{TaskRow,TaskRowSkeleton,TeamTasksHeader,ListFooter}.tsx` (header with "Show all tasks"), `features/tasks/hooks/useTasksList.ts`, route `app/(app)/(tabs)/tasks/index.tsx`, tabs `backBehavior="history"`.
- **Covers:** @AC-04.2.2, @AC-04.4.1, @AC-04.4.2, @AC-04.4.3, @AC-04.4.4, @AC-04.4.5, @AC-04.4.6, @AC-04.8.1, @AC-04.8.4, @AC-04.9.1–3.
- **Done when:** global list shows the 4 Background tasks (incl. no-team task); team list requests `teamId` and shows only its tasks; pages of 20 and end marker at 45; pull-to-refresh refetches page 1 and keeps filters; overdue row shows text + icon; deleted team → not-found state; row a11y label as design §8.

## T-004-14 — Add task filters: status, search, sort

- **Goal:** filter bar and sort sheet with per-list session filters.
- **Changes:** `src/features/tasks/store/taskFilters.ts`, `features/tasks/components/{TaskFilterBar,StatusSegments,SortSheet}.tsx`, `src/lib/debounce.ts` (`useDebouncedValue`, 300 ms), `TasksListScreen` integration, filtered empty-state with Clear filters.
- **Covers:** @AC-04.5.1, @AC-04.5.2, @AC-04.5.3, @AC-04.5.4, @AC-04.5.5.
- **Done when:** status filter combined with `teamId` (outline examples); fast typing produces one request (fake timers, MSW request counter); search trimmed and limited to 100; each sort option maps to the API value; per-scope filters kept when navigating between lists; reset after restart and on sign-out.

## T-004-15 — Build task detail with quick actions

- **Goal:** design S7: detail, status change, delete with confirmation; long-press status from list.
- **Changes:** `src/features/tasks/screens/TaskDetailScreen.tsx`, `features/tasks/components/{StatusQuickActions,StatusSheet,TaskMeta}.tsx`, `features/tasks/hooks/{useTaskDetail,useChangeTaskStatus,useDeleteTask}.ts` (mutation keys `['tasks','changeStatus']`, `['tasks','delete']`; `If-Match` from `version` on delete only — status toggle is last-write-wins per ADR-0015; idempotency key per user action), route `app/(app)/tasks/[id]/index.tsx`; long-press on `TaskRow` opens `StatusSheet`.
- **Covers:** @AC-04.6.1–7, @AC-04.8.3 (detail shows all chips).
- **Done when:** detail renders instantly from list cache; status change sends PATCH and updates detail + invalidates lists; same status sends nothing; delete confirm → back + toast + gone from lists; cancel keeps; server error → previous status + mapped toast; `TASK_NOT_FOUND` → not-found state; Undo restores previous status.

## T-004-16 — Build the create/edit task form

- **Goal:** design S8/S9 with validation and server-error mapping.
- **Changes:** `src/features/tasks/screens/TaskFormScreen.tsx`, `features/tasks/components/{TeamPicker,StatusField}.tsx`, `features/tasks/hooks/{useTaskForm,useSaveTask}.ts`, routes `app/(app)/tasks/new.tsx` (`?teamId`), `app/(app)/tasks/[id]/edit.tsx`.
- **Covers:** @AC-04.7.1–8, @AC-04.9.6.
- **Done when:** title boundaries (2, padded 2, 3, 120, 121); error clears on valid input; description capped at 2000; 10-team limit; past date hint; team preselected from team list; edit preload; `PRECONDITION_FAILED` dialog with reload; `UNKNOWN_TEAMS` removes ids and keeps input; dirty cancel asks; double press creates one task (same idempotency key, MSW counter).

## T-004-17 — Harden error handling, empty/loading states and accessibility

- **Goal:** close every cell of the design state matrix and the a11y checklist.
- **Changes:** state-matrix test suite `test/state-matrix.test.tsx` (each screen × state), `RATE_LIMITED` toast with seconds, `ROUTE_NOT_FOUND` copy, 200 % font-scale snapshots of key screens, focus management after modal close, live-region announcements, missing labels fixed.
- **Covers:** @AC-04.9.1–5, @AC-04.12.1, @AC-04.12.3, @AC-04.12.4, @AC-04.12.5.
- **Done when:** the matrix in design §7 is fully green; a test walks every pressable on each screen asserting label + role + 44 pt; error outline examples pass; manual VoiceOver/TalkBack checklist recorded in the PR.

## T-004-18 — Add Maestro E2E flows for the main journeys

- **Goal:** prove the brief's mobile journeys end to end against the seeded API.
- **Changes:** `apps/mobile/.maestro/{config.yaml,auth.yaml,filter-by-team.yaml,task-crud.yaml,validation.yaml}`, `testID`s where missing, script `pnpm --filter @hitss/mobile e2e`, notes for running against Expo Go (`openLink` to the Expo URL) or a dev client.
- **Covers:** @AC-04.1.2, @AC-04.2.2, @AC-04.4.1, @AC-04.6.2, @AC-04.6.4, @AC-04.7.1, @AC-04.7.2, @AC-04.8.1.
- **Done when:** flows pass locally twice in a row after `pnpm db:reset`; flows use seeded names, no coordinates.

## T-004-19 — Add Storybook for the UI kit (COULD)

- **Goal:** browse UI components in both themes.
- **Changes:** `@storybook/react-native` setup behind `EXPO_PUBLIC_STORYBOOK=true`, stories for `components/ui/*`.
- **Covers:** —
- **Done when:** Storybook opens in Expo Go with the flag; each UI component has default, dark and edge-case stories; disabled by default in normal runs.

## T-004-20 — Document running the app on a device

- **Goal:** an evaluator runs the app against the dockerized API without guessing.
- **Changes:** `apps/mobile/README.md` (prerequisites, `.env` setup, LAN IP / emulator / API tunnel options, WSL2 note, demo credentials, scripts, troubleshooting `errors.NETWORK`).
- **Covers:** —
- **Done when:** a fresh clone following only the README reaches the tasks list on a physical device on the same Wi-Fi.
