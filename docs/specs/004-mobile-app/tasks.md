# 004 — Tasks

Ordered; each task is one PR (Conventional Commits, [ADR-0017](../../architecture/adr/archive/0017-conventional-commits-and-atomic-prs.md)). Test-first: every task lands with the tests for the scenarios it covers. Offline/optimistic behavior is in [005 tasks](../005-offline-sync/tasks.md). Priorities follow D34 and the Maestro's split decisions: MUST tasks (01–20) come first; COULD work is in separate PRs (21–26) picked only after the MUST set and 005 are done. MUST tasks carry only minimal providers (English copy, theme following the device) and the accessibility baseline (names, roles, 44 pt targets, non-color cues, token contrast); theme switching, language switching and further a11y hardening are COULD. Team CRUD (US-04.3) is entirely MUST, so it stays one task. Paths follow overview §6.3 (`src/features/*`, `src/shared/*`, D28).

| ID       | Task                                                         | Priority | Depends on | Size | Branch                        |
| -------- | ------------------------------------------------------------ | -------- | ---------- | ---- | ----------------------------- |
| T-004-01 | Scaffold Expo app in the monorepo                            | MUST     | —          | S    | `chore/004-scaffold-expo-app` |
| T-004-02 | Add NativeWind, CSS-variable tokens and the `@apply` catalog | MUST     | 01         | M    | `feat/004-design-tokens`      |
| T-004-03 | Add minimal i18n and theme providers and the storage adapter | MUST     | 02         | S    | `feat/004-providers`          |
| T-004-04 | Generate the API client with orval and the fetch mutator     | MUST     | 01         | M    | `feat/004-api-client`         |
| T-004-05 | Wire QueryClient, query key factory and test harness         | MUST     | 03, 04     | S    | `feat/004-query-client`       |
| T-004-06 | Add auth client and the protected-route gate                 | MUST     | 05         | S    | `feat/004-auth-gate`          |
| T-004-07 | Build UI kit primitives                                      | MUST     | 02, 03     | M    | `feat/004-ui-primitives`      |
| T-004-08 | Build UI kit feedback and selection components               | MUST     | 07         | M    | `feat/004-ui-feedback`        |
| T-004-09 | Build the sign-in screen                                     | MUST     | 06, 07     | M    | `feat/004-sign-in`            |
| T-004-10 | Add tab navigation shell and Settings screen                 | MUST     | 06, 08     | S    | `feat/004-tabs-settings`      |
| T-004-11 | Add sign-out                                                 | MUST     | 10         | S    | `feat/004-sign-out`           |
| T-004-12 | Build the Teams list                                         | MUST     | 10         | M    | `feat/004-teams-list`         |
| T-004-13 | Build the team form (create, edit, delete)                   | MUST     | 12         | M    | `feat/004-team-form`          |
| T-004-14 | Build the Tasks list (global and per team)                   | MUST     | 12         | M    | `feat/004-tasks-list`         |
| T-004-15 | Add task filters: status and search                          | MUST     | 14         | M    | `feat/004-task-filters`       |
| T-004-16 | Build task detail with quick actions                         | MUST     | 14         | M    | `feat/004-task-detail`        |
| T-004-17 | Build the create/edit task form                              | MUST     | 16, 13     | M    | `feat/004-task-form`          |
| T-004-18 | Harden error handling and empty/loading states               | MUST     | 17         | M    | `fix/004-states`              |
| T-004-19 | Add Maestro E2E flows for the main journeys                  | MUST     | 18, 11     | S    | `test/004-maestro-flows`      |
| T-004-20 | Document running the app on a device                         | MUST     | 09         | S    | `docs/004-mobile-readme`      |
| T-004-21 | Build the sign-up screen                                     | COULD    | 09         | S    | `feat/004-sign-up`            |
| T-004-22 | Add task sort                                                | COULD    | 15         | S    | `feat/004-task-sort`          |
| T-004-23 | Add theme switching                                          | COULD    | 10         | S    | `feat/004-theme-switching`    |
| T-004-24 | Add language switching                                       | COULD    | 10         | M    | `feat/004-language-switching` |
| T-004-25 | Harden accessibility                                         | COULD    | 18         | M    | `fix/004-a11y`                |
| T-004-26 | Add Storybook for the UI kit                                 | COULD    | 08         | S    | `chore/004-storybook`         |

## T-004-01 — Scaffold Expo app in the monorepo

- **Goal:** an empty Expo Router app `@hitss/mobile` that boots in Expo Go and participates in Turborepo tasks.
- **Changes:** `apps/mobile/` from the Expo Router template (latest stable SDK, TypeScript strict, `noUncheckedIndexedAccess`), `app.config.ts` (name, slug, scheme `teamstasks` — must equal the API's `APP_SCHEME` from spec 001, `experiments.typedRoutes`), `src/shared/config/env.ts` (zod-validated `EXPO_PUBLIC_API_URL`), `.dependency-cruiser.cjs` with the overview's rules M1–M6, `.env.example`, `metro.config.js` monorepo-aware (watchFolders, `node-linker` compatibility), ESLint (`eslint-config-expo`) + Prettier, `jest.config.js` (`jest-expo` preset), `package.json` scripts `start`, `lint`, `typecheck`, `test`; root `turbo.json` pipeline entries.
- **Covers:** @AC-04.15.1 (CI dependency check: `styled-components` / CSS-in-JS runtimes such as `@emotion/*` banned in `apps/mobile/package.json`, via dependency-cruiser `forbidden` + a package.json lint script).
- **Done when:** `pnpm --filter @hitss/mobile start` opens a placeholder screen in Expo Go on iOS and Android; `lint typecheck test` pass in CI; missing `EXPO_PUBLIC_API_URL` fails fast with a readable message, and a non-`https` URL is rejected when `__DEV__` is false (unit tests, T4).

## T-004-02 — Add NativeWind, design tokens and the `@apply` catalog

- **Goal:** design spec §1–§2 available as Tailwind theme and semantic classes.
- **Changes:** `global.css` (color tokens as CSS variables under `:root` / `.dark`, then the §2 catalog built on them; `dark:` only for the exceptions the design spec lists — ADR-0011, D29), `tailwind.config.js` (design §1.6, colors mapped to `rgb(var(--color-…) / <alpha-value>)`, `darkMode: 'class'`), `babel.config.js` / `metro.config.js` NativeWind setup, `nativewind-env.d.ts`, `src/shared/theme/tokens.ts` (`{ light, dark }` hex keyed by role name for non-className consumers), `src/shared/theme/contrast.ts` (`contrastingText`, `needsOutline`, `contrastRatio`).
- **Covers:** @AC-04.8.2, @AC-04.12.2 (baseline: token contrast unit test).
- **Done when:** table-driven tests for every preset in design §1.3 and the feature's chip examples pass; a test asserts all text token pairs in §1.1/§1.2 are ≥ 4.5:1; a smoke screen renders each catalog class in light and dark; a test parses `global.css` and asserts `tokens.ts` parity for both themes; the only `dark:` usage in the catalog is the design-spec exception (`.card` shadow).

## T-004-03 — Add minimal i18n and theme providers and the storage adapter

- **Goal:** the MUST baseline: all copy through i18n keys (English), theme from CSS variables following the device, a storage seam for later persistence. Switching theme or language is COULD (T-004-23, T-004-24).
- **Changes:** `src/shared/i18n/` (i18next init with `en` only, `I18nProvider.tsx`, `dates.ts` — due dates parsed as local calendar dates, `locales/en.json` with all design §9 keys), `src/shared/theme/ThemeProvider.tsx` (NativeWind default `system` color scheme, `StatusBar` style), `src/shared/storage/` (`storage-adapter.ts` interface, `async-storage.adapter.ts`, `memory.adapter.ts` for tests; reused by 005 and the COULD preferences store).
- **Covers:** infrastructure (copy keys for every MUST screen; BR-04.10 date handling).
- **Done when:** every screen string resolves from `en.json` (missing-key test); dates never shift by time zone (tests across TZ env); `StorageAdapter` contract test passes for AsyncStorage and memory adapters.

## T-004-04 — Generate the API client with orval and the fetch mutator

- **Goal:** typed React Query hooks and zod schemas from the API's OpenAPI; one place for auth headers and error mapping.
- **Changes:** `packages/api-client/` (`package.json` `@hitss/api-client`, `orval.config.ts` per plan, `src/mutator.ts` `customFetch` + `configureApiClient`, `src/errors.ts` `ApiError`/`errorMessageKey`/`fieldErrors`, `src/index.ts`; the mutator returns the `{ data, meta? }` envelope unchanged — D35), Turborepo `generate` task depending on the API's OpenAPI export.
- **Covers:** @AC-04.9.5 (unit), @AC-04.1.6 (unit: 401 hook).
- **Done when:** generation is reproducible from `openapi.json`; mutator unit tests cover 2xx envelope, 204, each error code in the contract table, unknown code fallback, network failure, timeout, `Retry-After` on `429` and `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` → `retryAfter` clamped to 1–60 s and `parseRetryAfter` for `X-Retry-After` (T5), `Cookie` attached only when the URL starts with `baseUrl` and foreign absolute URLs rejected (T3), `X-Request-Id` matches `[A-Za-z0-9._-]{1,128}`, 401 callback, `If-Match`/`Idempotency-Key` passthrough.

## T-004-05 — Wire QueryClient, query key factory and test harness

- **Goal:** server-state infrastructure and a reusable test render.
- **Changes:** `src/shared/query/query-client.ts` (defaults per plan incl. retry of `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` after `Retry-After`, `focusManager` ↔ `AppState`), `src/shared/query/keys.ts` (`qk`, mutation keys), `src/shared/query/QueryProvider.tsx`, provider composition in `app/_layout.tsx`, `test/setup.ts` (MSW server, RNTL matchers), `test/handlers/*.ts` (teams/tasks fixtures mirroring the feature Background), `test/renderWithProviders.tsx`.
- **Covers:** @AC-04.15.3 (ESLint `no-restricted-imports`: `src/features/**/components/**` and `app/**` may import only generated hooks — `use*` — from `@hitss/api-client`, never the raw request functions or `customFetch`; a lint fixture test proves the rule fails).
- **Done when:** a sample component test fetches through a generated hook against MSW; key-factory unit tests; invalidation helpers (`invalidateAfter(mutationKey)`) unit-tested against the plan's table.

## T-004-06 — Add auth client and the protected-route gate

- **Goal:** only signed-in users reach `(app)`; session restored on launch without a sign-in flash.
- **Changes:** `src/features/auth/auth-client.ts` (`expoClient` + `expo-secure-store`, scheme from `app.config.ts`), `src/shared/config/api-client.ts` (`setupApiClient`), `app/_layout.tsx` (splash hold; `setupApiClient` wiring: `Cookie` from `authClient.getCookie()`, `onUnauthenticated` → clear the query cache only — paused mutations are kept (security T2) — and sign out locally), `app/(auth)/_layout.tsx` and `app/(app)/_layout.tsx` (redirects per ADR-0009).
- **Covers:** @AC-04.1.1, @AC-04.1.6, @AC-04.1.7 (Cookie from `authClient.getCookie()` on every API request, no bearer token).
- **Done when:** router tests (`renderRouter`) show unauthenticated → sign-in, authenticated → tasks, 401 during a query → sign-in with the session-expired message and paused mutations still in the mutation cache; a mutator test asserts the `Cookie` header comes from `getCookie()`.

## T-004-07 — Build UI kit primitives

- **Goal:** lean, accessible building blocks using only catalog classes.
- **Changes:** `src/shared/ui/{Button,IconButton,Fab,Input,TextArea,Field,SearchInput,Skeleton,EmptyState,ErrorState,Screen}.tsx`, `src/shared/ui/useDebouncedValue.ts` (300 ms) + tests.
- **Covers:** @AC-04.12.1 (baseline: name, role and 44 pt target on every shared component).
- **Done when:** each component has role/label/state tests, min 44 pt target assertion, semantic-class assertions.

## T-004-08 — Build UI kit feedback and selection components

- **Goal:** the remaining shared components of the design.
- **Changes:** `src/shared/ui/{TeamChip,TeamChipGroup,StatusBadge,SegmentedControl,Toast,Toaster,Sheet,ConfirmDialog,DatePickerField,OfflineBanner}.tsx`, `src/shared/stores/toast.store.ts`.
- **Covers:** @AC-04.8.1, @AC-04.8.2, @AC-04.8.3, @AC-04.8.5, @AC-04.9.4, @AC-04.12.5 (baseline: status and selection shown with icon/text, not color only).
- **Done when:** TeamChip text/outline follow the rule for the feature's examples in both themes; group shows 3 + `+N` (list variant) or all (detail variant) and announces "Teams: …"; StatusBadge always renders icon + label; Toast auto-hides (fake timers), is announced, supports an action; ConfirmDialog focuses Cancel first.

## T-004-09 — Build the sign-in screen

- **Goal:** design S1 with validation and mapped errors (sign-in MUST, D34).
- **Changes:** `src/features/auth/components/SignInScreen.tsx`, `features/auth/hooks/useSignIn.ts` (rhf + zod), route `app/(auth)/sign-in.tsx` (the "Create account" link is hidden until T-004-21 lands).
- **Covers:** @AC-04.1.2, @AC-04.1.3.
- **Done when:** component tests: success navigates; wrong credentials banner; `429` shows seconds from `X-Retry-After` (clamped 1–60 s); submitting disables inputs; offline disables submit with hint; show/hide password labelled.

## T-004-10 — Add tab navigation shell and Settings screen

- **Goal:** Tasks / Teams / Settings tabs; Settings per design S5 with the account card (theme and language rows arrive with T-004-23/24, Sign out with T-004-11).
- **Changes:** `app/(app)/(tabs)/_layout.tsx`, placeholder tab routes, `src/features/settings/components/SettingsScreen.tsx` + `features/settings/index.ts`, `src/shared/theme/navigation-theme.ts` (light and dark from `tokens.ts`).
- **Covers:** infrastructure (navigation shell for US-04.2/04.4).
- **Done when:** tests: three tabs with translated, labelled icons; Settings shows the signed-in user's name and email; `backBehavior="history"`.

## T-004-11 — Add sign-out

- **Goal:** sign out from Settings removes the session and all local data (US-04.16 MUST).
- **Changes:** `src/features/auth/hooks/useSignOut.ts` (exported via `features/auth/index.ts`), Sign out row + confirmation in `SettingsScreen`; sequence per plan: **await** SecureStore session deletion (`authClient.signOut()`) — and, once 005 lands, `persister.removeClient()` — then `queryClient.clear()`, reset `filters.store`, then navigate (security T7).
- **Covers:** @AC-04.16.1.
- **Done when:** component test: navigation happens only after storage removal resolves; query cache and filter store are empty afterwards; the sign-in screen is shown; signing in again starts with unfiltered lists.

## T-004-12 — Build the Teams list

- **Goal:** design S4 with tap → team tasks.
- **Changes:** `src/features/teams/components/TeamsListScreen.tsx`, `features/teams/components/{TeamCard,TeamCardSkeleton,TeamOptionsSheet}.tsx`, `features/teams/hooks/useTeamsList.ts` (infinite, `sort=name`, debounced search), route `app/(app)/(tabs)/teams/index.tsx`.
- **Covers:** @AC-04.2.1, @AC-04.2.2 (navigation), @AC-04.2.3, @AC-04.2.4, @AC-04.9.1, @AC-04.9.2, @AC-04.9.3.
- **Done when:** component tests for loading skeleton, empty, empty-with-search, error + retry, list with counts in name order, infinite scroll requests `offset=20`, pull-to-refresh, tap navigates to `/tasks?teamId=<id>`.

## T-004-13 — Build the team form (create, edit, delete)

- **Goal:** design S10/S11.
- **Changes:** `src/features/teams/components/TeamFormScreen.tsx`, `features/teams/components/{ColorSwatchGrid,ChipPreview}.tsx`, `features/teams/hooks/{useTeamForm,useTeamMutations}.ts` (mutation keys from `qk`, invalidation per plan), routes `app/(app)/teams/new.tsx`, `app/(app)/teams/[id]/edit.tsx`; delete from options sheet and form.
- **Covers:** @AC-04.3.1, @AC-04.3.2, @AC-04.3.3, @AC-04.3.4, @AC-04.3.5.
- **Done when:** name boundaries 1/2/50/51; duplicate name error on field from `TEAM_NAME_ALREADY_EXISTS`; hex validation + uppercase; preview chip uses the contrast rule; update invalidates `tasks.all`; delete requires confirmation and tasks remain (MSW state); conflict dialog on `PRECONDITION_FAILED`.

## T-004-14 — Build the Tasks list (global and per team)

- **Goal:** design S3/S6 list with infinite scroll and pull to refresh (filters come in T-004-15).
- **Changes:** `src/features/tasks/components/TasksListScreen.tsx` (prop `teamId?` from the `?teamId=` search param), `features/tasks/components/{TaskRow,TaskRowSkeleton,TeamTasksHeader,ListFooter}.tsx` (header with "Show all tasks"), `features/tasks/hooks/useTasksList.ts`, route `app/(app)/(tabs)/tasks/index.tsx`, tabs `backBehavior="history"`.
- **Covers:** @AC-04.2.2, @AC-04.4.1, @AC-04.4.2, @AC-04.4.3, @AC-04.4.4, @AC-04.4.5, @AC-04.4.6, @AC-04.8.1, @AC-04.8.4, @AC-04.9.1, @AC-04.9.2, @AC-04.9.3.
- **Done when:** global list shows the 4 Background tasks (incl. no-team task); team list requests `teamId` and shows only its tasks; pages of 20 and end marker at 45; pull-to-refresh refetches page 1 and keeps filters; overdue row shows text + icon; deleted team → not-found state; row a11y label as design §8.

## T-004-15 — Add task filters: status and search

- **Goal:** filter bar with per-list session filters (status filter + search MUST, D34).
- **Changes:** `src/shared/stores/filters.store.ts` (`byScope[scope].status: TaskStatus | 'ALL'`, default `'ALL'`, single-select — D32; `search`), `features/tasks/components/{TaskFilterBar,StatusFilter}.tsx` (single-select `SegmentedControl`: All · Pending · In progress · Done), `TasksListScreen` integration (debounced search via `useDebouncedValue`), filtered empty-state with Clear filters.
- **Covers:** @AC-04.5.1, @AC-04.5.2, @AC-04.5.4, @AC-04.5.5.
- **Done when:** status filter combined with `teamId` (outline examples); `'ALL'` sends no `status` param and any other value sends exactly one; fast typing produces one request (fake timers, MSW request counter); search trimmed and limited to 100; per-scope filters kept when navigating between lists; reset after restart and on sign-out.

## T-004-16 — Build task detail with quick actions

- **Goal:** design S7: detail, status change, delete with confirmation; long-press status from list.
- **Changes:** `src/features/tasks/components/TaskDetailScreen.tsx`, `features/tasks/components/{StatusQuickActions,StatusSheet,TaskMeta}.tsx`, `features/tasks/hooks/{useTaskDetail,useChangeTaskStatus,useDeleteTask}.ts` (mutation keys `['tasks','changeStatus']`, `['tasks','delete']`; `If-Match` from `version` on delete only — status toggle is last-write-wins per ADR-0015; no `Idempotency-Key`: `PATCH`/`DELETE` are naturally idempotent, D31), route `app/(app)/tasks/[id]/index.tsx`; long-press on `TaskRow` opens `StatusSheet`.
- **Covers:** @AC-04.6.1, @AC-04.6.2, @AC-04.6.3, @AC-04.6.4, @AC-04.6.5, @AC-04.6.6, @AC-04.6.7, @AC-04.8.3 (detail shows all chips).
- **Done when:** detail renders instantly from list cache; status change sends PATCH and updates detail + invalidates lists; same status sends nothing; delete confirm → back + toast + gone from lists; cancel keeps; server error → previous status + mapped toast; `TASK_NOT_FOUND` → not-found state; Undo restores previous status.

## T-004-17 — Build the create/edit task form

- **Goal:** design S8/S9 with validation and server-error mapping.
- **Changes:** `src/features/tasks/components/TaskFormScreen.tsx`, `features/tasks/components/{TeamPicker,StatusField}.tsx`, `features/tasks/hooks/{useTaskForm,useSaveTask}.ts`, routes `app/(app)/tasks/new.tsx` (`?teamId`), `app/(app)/tasks/[id]/edit.tsx`.
- **Covers:** @AC-04.7.1, @AC-04.7.2, @AC-04.7.3, @AC-04.7.4, @AC-04.7.5, @AC-04.7.6, @AC-04.7.7, @AC-04.7.8, @AC-04.9.6, @AC-04.15.2 (stack-guard test: every `*Form*`/`SignIn*` hook under `src/features/**` uses `useForm` with `zodResolver`; fails if a form screen bypasses them).
- **Done when:** title boundaries (2, padded 2, 3, 120, 121); error clears on valid input; description capped at 2000; 10-team limit; past date hint; team preselected from team list; edit preload; `PRECONDITION_FAILED` dialog with reload; `UNKNOWN_TEAMS` removes ids and keeps input; dirty cancel asks; double press creates one task (same `Idempotency-Key` on the `POST`; `PUT` on edit sends none — D31; MSW counter).

## T-004-18 — Harden error handling and empty/loading states

- **Goal:** close every cell of the design state matrix (a11y hardening beyond the baseline is COULD, T-004-25).
- **Changes:** state-matrix test suite `test/state-matrix.test.tsx` (each screen × state), `RATE_LIMITED` toast with seconds, `ROUTE_NOT_FOUND` copy, missing error mappings fixed.
- **Covers:** @AC-04.9.1, @AC-04.9.2, @AC-04.9.3, @AC-04.9.4, @AC-04.9.5.
- **Done when:** the matrix in design §7 is fully green; error outline examples pass.

## T-004-19 — Add Maestro E2E flows for the main journeys

- **Goal:** prove the brief's mobile journeys end to end against the seeded API.
- **Changes:** `apps/mobile/e2e/maestro/{config.yaml,auth.yaml,filter-by-team.yaml,task-crud.yaml,validation.yaml}`, `testID`s where missing, script `pnpm --filter @hitss/mobile e2e`, notes for running against Expo Go (`openLink` to the Expo URL) or a dev client.
- **Covers:** @AC-04.1.2, @AC-04.2.2, @AC-04.4.1, @AC-04.6.2, @AC-04.6.4, @AC-04.7.1, @AC-04.7.2, @AC-04.8.1.
- **Done when:** flows pass locally twice in a row after `pnpm db:reset`; flows use seeded names, no coordinates.

## T-004-20 — Document running the app on a device

- **Goal:** an evaluator runs the app against the dockerized API without guessing.
- **Changes:** `apps/mobile/README.md` (prerequisites, `.env` setup, LAN IP / emulator / API tunnel options, WSL2 note, demo credentials, scripts, troubleshooting `errors.NETWORK`).
- **Covers:** —
- **Done when:** a fresh clone following only the README reaches the tasks list on a physical device on the same Wi-Fi.

## T-004-21 — Build the sign-up screen (COULD)

- **Goal:** design S2 (sign-up COULD; seeded demo users cover the MUST journeys).
- **Changes:** `src/features/auth/components/SignUpScreen.tsx`, `features/auth/hooks/useSignUp.ts` (rhf + zod), route `app/(auth)/sign-up.tsx`, "Create account" link on Sign in.
- **Covers:** @AC-04.13.1.
- **Done when:** component tests: success signs in and navigates; password boundaries 7/8/128/129; email taken on field for both `USER_ALREADY_EXISTS` and `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` (contract test pins the codes, T6); submitting disables inputs; offline disables submit with hint.

## T-004-22 — Add task sort (COULD)

- **Goal:** sort sheet for task lists (sort COULD, D34); until it lands lists use the API default order.
- **Changes:** `filters.store.ts` `sort` field, `features/tasks/components/SortSheet.tsx`, sort button in `TaskFilterBar`.
- **Covers:** @AC-04.14.1.
- **Done when:** each sort option maps to the API value; sort is kept per scope and reset with the other filters.

## T-004-23 — Add theme switching (COULD)

- **Goal:** Light / Dark / System choice in Settings, kept after restart (US-04.10).
- **Changes:** `src/shared/stores/preferences.store.ts` (Zustand + immer + persist over the `StorageAdapter`; `theme: system | light | dark`), `ThemeProvider` reads it and calls NativeWind `colorScheme.set`, theme segmented row in `SettingsScreen`.
- **Covers:** @AC-04.10.1, @AC-04.10.2.
- **Done when:** tests: `system` follows `Appearance` changes while open; Light/Dark switch the whole app immediately (CSS-variable swap; navigation theme and `StatusBar` follow); choice persists (memory adapter); light/dark class assertions on catalog smoke screen.

## T-004-24 — Add language switching (COULD)

- **Goal:** Brazilian Portuguese and a language choice in Settings (US-04.11, D33).
- **Changes:** `locales/pt-BR.json` (all design §9 keys), device-locale detection (`expo-localization`), `language: system | en | pt-BR` in `preferences.store.ts`, language radio list (System / English / Português (Brasil)) in `SettingsScreen`, locale-aware `Intl` formatting in `dates.ts`, `Accept-Language` from the current language.
- **Covers:** @AC-04.11.1, @AC-04.11.2.
- **Done when:** locale key-parity test passes; with `system`, `pt`/`pt-PT` → pt-BR, others → en; explicit `en`/`pt-BR` override the device; text, errors and dates switch immediately; choice persists.

## T-004-25 — Harden accessibility (COULD)

- **Goal:** the full a11y checklist of design §8 beyond the MUST baseline (US-04.12).
- **Changes:** 200 % font-scale snapshots of key screens, Skeleton/animations static when `AccessibilityInfo.isReduceMotionEnabled`, focus management after modal close, live-region announcements, a test that walks every pressable on each screen, missing labels fixed.
- **Covers:** @AC-04.12.1, @AC-04.12.3, @AC-04.12.4, @AC-04.12.5 (full checks).
- **Done when:** walk test asserts label + role + 44 pt on every screen; no truncation at 200 %; reduced motion disables decorative animation; manual VoiceOver/TalkBack checklist recorded in the PR.

## T-004-26 — Add Storybook for the UI kit (COULD)

- **Goal:** browse UI components in both themes.
- **Changes:** `@storybook/react-native` setup behind `EXPO_PUBLIC_STORYBOOK=true`, stories for `shared/ui/*`.
- **Covers:** —
- **Done when:** Storybook opens in Expo Go with the flag; each UI component has default, dark and edge-case stories; disabled by default in normal runs.
