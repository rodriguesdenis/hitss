# 004 — Tasks

Tasks are grouped into **milestones: one PR per milestone**, with one or more atomic commits per task (Conventional Commits, scopes `mobile` / `api-client`). Task ids stay stable. Test-first: every task lands with the tests for the scenarios it covers. Offline/optimistic behavior is [005](../005-offline-sync/tasks.md) (M5). MUST tasks carry the accessibility baseline (names, roles, 44 pt targets, non-color cues, token contrast); theme switching and further a11y hardening are COULD. Copy is pt-BR only (design spec §9, pt-BR column). Paths follow the [plan](plan.md#folder-structure).

## Milestones

| Milestone                  | Tasks                   | Owner           | Branch                   | Depends on           |
| -------------------------- | ----------------------- | --------------- | ------------------------ | -------------------- |
| M1 foundation + api-client | T-004-01..05, T-007-10  | Forge + Gantry  | `feat/004-m1-foundation` | M0 (docs)            |
| M2 auth + shell + UI       | T-004-06..11            | Forge           | `feat/004-m2-auth-shell` | M1                   |
| M3 teams                   | T-004-12, T-004-13      | Strata          | `feat/004-m3-teams`      | M2                   |
| M4 tasks                   | T-004-14..17            | Strata          | `feat/004-m4-tasks`      | M3                   |
| M5 offline                 | spec 005 (T-005-01..11) | Forge           | `feat/005-m5-offline`    | M2; parallel with M4 |
| M6 finishing               | T-004-18..20, T-007-13  | Strata + Gantry | `feat/004-m6-finishing`  | M4, M5               |
| Later (COULD)              | T-004-21..23, T-004-25  | —               | —                        | M6                   |

| ID       | Task                                                         | Priority | Milestone | Depends on |
| -------- | ------------------------------------------------------------ | -------- | --------- | ---------- |
| T-004-01 | Scaffold Expo app in the monorepo                            | MUST     | M1        | —          |
| T-004-02 | Add NativeWind, CSS-variable tokens and the `@apply` catalog | MUST     | M1        | 01         |
| T-004-03 | Add the theme provider and the storage adapter               | MUST     | M1        | 02         |
| T-004-04 | Generate the API client with orval and the Bearer mutator    | MUST     | M1        | 01         |
| T-004-05 | Wire QueryClient, query key factory and test harness         | MUST     | M1        | 03, 04     |
| T-004-06 | Add auth client and the protected-route gate                 | MUST     | M2        | 05         |
| T-004-07 | Build UI kit primitives                                      | MUST     | M2        | 02, 03     |
| T-004-08 | Build UI kit feedback and selection components               | MUST     | M2        | 07         |
| T-004-09 | Build the sign-in screen                                     | MUST     | M2        | 06, 07     |
| T-004-10 | Add tab navigation shell and Settings screen                 | MUST     | M2        | 06, 08     |
| T-004-11 | Add sign-out                                                 | MUST     | M2        | 10         |
| T-004-12 | Build the Teams list                                         | MUST     | M3        | 10         |
| T-004-13 | Build the team form (create, edit, delete)                   | MUST     | M3        | 12         |
| T-004-14 | Build the Tasks list (global and per team)                   | MUST     | M4        | 12         |
| T-004-15 | Add task filters: status and search                          | MUST     | M4        | 14         |
| T-004-16 | Build task detail with quick actions                         | MUST     | M4        | 14         |
| T-004-17 | Build the create/edit task form                              | MUST     | M4        | 16, 13     |
| T-004-18 | Harden error handling and empty/loading states               | MUST     | M6        | 17         |
| T-004-19 | Add Maestro flows for the main journeys                      | MUST     | M6        | 18, 11     |
| T-004-20 | Document running the app on a device                         | MUST     | M6        | 09         |
| T-004-21 | Build the sign-up screen                                     | COULD    | later     | 09         |
| T-004-22 | Add task sort                                                | COULD    | later     | 15         |
| T-004-23 | Add theme switching                                          | COULD    | later     | 10         |
| T-004-24 | ~~Add language switching~~ — dropped: pt-BR only             | —        | —         | —          |
| T-004-25 | Harden accessibility                                         | COULD    | later     | 18         |
| T-004-26 | ~~Add Storybook~~ — dropped: out of scope                    | —        | —         | —          |

T-007-10 (OpenAPI export without a database, `generate` script, contract drift job in CI) and T-007-13 (optional Metro service in compose) are specified in [007 tasks](../007-ci-and-dx/tasks.md) and delivered by Gantry inside M1 and M6.

## T-004-01 — Scaffold Expo app in the monorepo

- **Goal:** an empty Expo Router app `@hitss/mobile` that boots in Expo Go and joins the Turborepo tasks.
- **Changes:** `apps/mobile/` from the Expo Router template (latest stable SDK, TypeScript strict, `noUncheckedIndexedAccess`), `app.config.ts` (scheme `teamstasks` = the API's `APP_SCHEME`, typed routes), `src/lib/env.ts` (zod-validated `EXPO_PUBLIC_API_URL`), `.dependency-cruiser.cjs` with the plan's rules, `.env.example`, monorepo-aware `metro.config.js`, ESLint (`eslint-config-expo`) + Prettier, `jest.config.js` (`jest-expo`), scripts `start`, `lint`, `typecheck`, `test`; root `turbo.json` entries.
- **Covers:** @AC-04.15.1 (`styled-components` / `@emotion/*` banned in `apps/mobile/package.json` by a dependency check).
- **Done when:** `pnpm --filter @hitss/mobile start` opens a placeholder screen in Expo Go; `lint typecheck test` pass in CI; a missing `EXPO_PUBLIC_API_URL` fails fast with a readable message and a non-`https` URL is rejected outside `__DEV__` (unit tests).

## T-004-02 — Add NativeWind, CSS-variable tokens and the `@apply` catalog

- **Goal:** design spec §1–§2 available as Tailwind theme and semantic classes.
- **Changes:** `src/theme/global.css` (color tokens as CSS variables under `:root` / `.dark`, then the §2 catalog; `dark:` only for the design-spec exceptions), `tailwind.config.js` (design §1.6, colors as `rgb(var(--color-…) / <alpha-value>)`), NativeWind babel/metro setup, `nativewind-env.d.ts`, `src/theme/tokens.ts`, `src/theme/contrast.ts` (`contrastingText`, `needsOutline`, `contrastRatio`).
- **Covers:** @AC-04.8.2, @AC-04.12.2 (baseline: token contrast unit test).
- **Done when:** table-driven tests for every preset in design §1.3 and the feature's chip examples; all text token pairs in §1.1/§1.2 ≥ 4.5:1; a smoke screen renders each catalog class in light and dark; `tokens.ts` parity with `global.css`.

## T-004-03 — Add the theme provider and the storage adapter

- **Goal:** theme from CSS variables following the device and a storage seam for 005. No i18n library: copy is pt-BR literals.
- **Changes:** `src/theme/ThemeProvider.tsx` (NativeWind `system` color scheme, `StatusBar` style, navigation theme from `tokens.ts`), `src/lib/storage.ts` (`StorageAdapter` interface, AsyncStorage implementation, memory implementation for tests), `src/lib/dates.ts` (pt-BR `Intl` formatting; due dates parsed as local calendar dates).
- **Covers:** infrastructure (BR-04.10 date handling).
- **Done when:** the app switches light/dark with the device; dates never shift by time zone (tests across TZ env); the `StorageAdapter` contract test passes for both implementations.

## T-004-04 — Generate the API client with orval and the Bearer mutator

- **Goal:** typed React Query hooks and zod schemas from the API's OpenAPI; one place for the token and error mapping.
- **Changes:** `packages/api-client/` (`@hitss/api-client`, `orval.config.ts` per plan reading the exported `openapi.json`, `src/mutator.ts` `customFetch` + `configureApiClient({ baseUrl, getToken, onUnauthenticated })`, `src/errors.ts` `ApiError` / `isApiError` / `fieldErrors`, `src/index.ts`), Turborepo `generate` task; `apps/mobile/src/lib/error-messages.ts` (code → pt-BR message, unknown → generic).
- **Covers:** @AC-04.1.7 (unit: Bearer header), @AC-04.9.5 (unit), @AC-04.1.6 (unit: 401 hook).
- **Done when:** generation is reproducible from `openapi.json`; mutator unit tests cover the 2xx envelope, 204, each error code in the contract table, unknown-code fallback, network failure, timeout, `Retry-After` clamped to 1–60 s, `Authorization: Bearer` attached only when the URL starts with `baseUrl` and foreign absolute URLs rejected, no header when there is no token, `X-Request-Id` format, 401 callback.

## T-004-05 — Wire QueryClient, query key factory and test harness

- **Goal:** server-state infrastructure and a reusable test render.
- **Changes:** `src/lib/query-client.ts` (defaults per plan, `focusManager` ↔ `AppState`), `src/lib/query-keys.ts` (`qk`, mutation keys), `QueryProvider`, provider composition in `app/_layout.tsx`, `tests/setup.ts` (MSW server, RNTL matchers), `tests/handlers/*.ts` (fixtures mirroring the feature Background), `tests/renderWithProviders.tsx`.
- **Covers:** @AC-04.15.3 (ESLint `no-restricted-imports`: `src/features/**/components/**` and `app/**` import only generated `use*` hooks from `@hitss/api-client`, never raw request functions or `customFetch`; a lint fixture proves the rule fails).
- **Done when:** a sample component test fetches through a generated hook against MSW; key-factory and invalidation-helper unit tests against the plan's table.

## T-004-06 — Add auth client and the protected-route gate

- **Goal:** only signed-in users reach the tabs; session restored on launch without a sign-in flash.
- **Changes:** `src/features/auth/auth-client.ts` (`expoClient` + `expo-secure-store`; `set-auth-token` captured into SecureStore; Better Auth calls also use `Bearer`), `features/auth/token.ts` (`getToken`, `setToken`, `deleteToken`), `configureApiClient` wiring in `app/_layout.tsx` (`getToken`; `onUnauthenticated` → delete token, clear the query cache, session-expired message), `AuthGate` redirects between `(auth)` and `(tabs)`.
- **Covers:** @AC-04.1.1, @AC-04.1.6, @AC-04.1.7.
- **Done when:** router tests: unauthenticated → sign-in, authenticated → tasks, 401 during a query → sign-in with "Sua sessão expirou. Entre novamente."; an MSW test asserts `set-auth-token` → SecureStore → `Authorization: Bearer` on the next `/api/v1` request; the token never appears in the query cache or logger output.

## T-004-07 — Build UI kit primitives

- **Goal:** lean, accessible building blocks using only catalog classes.
- **Changes:** `src/ui/{Button,IconButton,Fab,Input,TextArea,Field,SearchInput,Skeleton,EmptyState,ErrorState,Screen}.tsx`, `src/ui/useDebouncedValue.ts` (300 ms).
- **Covers:** @AC-04.12.1 (baseline: name, role and 44 pt target on every shared component).
- **Done when:** each component has role/label/state tests, a min 44 pt target assertion and semantic-class assertions.

## T-004-08 — Build UI kit feedback and selection components

- **Goal:** the remaining shared components of the design.
- **Changes:** `src/ui/{TeamChip,TeamChipGroup,StatusBadge,SegmentedControl,Toast,Toaster,Sheet,ConfirmDialog,DatePickerField,OfflineBanner}.tsx`, `src/ui/toast.store.ts`.
- **Covers:** @AC-04.8.1, @AC-04.8.2, @AC-04.8.3, @AC-04.8.5, @AC-04.9.4, @AC-04.12.5 (baseline).
- **Done when:** TeamChip text/outline follow the rule in both themes; the group shows 3 + `+N` (list) or all (detail) and announces "Times: …"; StatusBadge renders icon + label; Toast auto-hides (fake timers), is announced and supports an action; ConfirmDialog focuses Cancelar first.

## T-004-09 — Build the sign-in screen

- **Goal:** design S1 with validation and mapped errors.
- **Changes:** `src/features/auth/components/SignInScreen.tsx`, `features/auth/hooks/useSignIn.ts` (rhf + zod), route `app/(auth)/sign-in.tsx` (no "Criar conta" link until T-004-21).
- **Covers:** @AC-04.1.2, @AC-04.1.3.
- **Done when:** success stores the token and navigates; wrong credentials → "E-mail ou senha incorretos"; `429` shows seconds from `X-Retry-After`; submitting disables inputs; show/hide password labelled.

## T-004-10 — Add tab navigation shell and Settings screen

- **Goal:** Tarefas / Times / Ajustes tabs; Settings per design S5 with the account card (no language row; the theme row is COULD, T-004-23).
- **Changes:** `app/(tabs)/_layout.tsx`, placeholder tab routes, `src/features/auth/components/SettingsScreen.tsx`.
- **Covers:** infrastructure (navigation shell for US-04.2/04.4).
- **Done when:** three labelled tabs with icons; Settings shows the signed-in user's name and email; `backBehavior="history"`.

## T-004-11 — Add sign-out

- **Goal:** sign out from Settings removes the token and all local data (US-04.16).
- **Changes:** `src/features/auth/hooks/useSignOut.ts`, Sair row + confirmation in `SettingsScreen`; sequence per plan: **await** `authClient.signOut()` and token deletion (and, from M5, persisted cache and queue removal), then `queryClient.clear()`, reset the filter store, then navigate.
- **Covers:** @AC-04.16.1.
- **Done when:** navigation happens only after storage removal resolves; SecureStore holds no token; query cache and filter store are empty; signing in again starts with unfiltered lists.

## T-004-12 — Build the Teams list

- **Goal:** design S4 with tap → team tasks.
- **Changes:** `src/features/teams/components/{TeamsListScreen,TeamCard,TeamCardSkeleton,TeamOptionsSheet}.tsx`, `features/teams/hooks/useTeamsList.ts` (infinite, `sort=name`, debounced search), route `app/(tabs)/teams.tsx`.
- **Covers:** @AC-04.2.1, @AC-04.2.2 (navigation), @AC-04.2.3, @AC-04.2.4, @AC-04.9.1, @AC-04.9.2, @AC-04.9.3.
- **Done when:** component tests for skeleton, empty, empty-with-search, error + retry, list with counts in name order, infinite scroll requests `offset=20`, pull-to-refresh, tap navigates to `/tasks?teamId=<id>`.

## T-004-13 — Build the team form (create, edit, delete)

- **Goal:** design S10/S11.
- **Changes:** `src/features/teams/components/{TeamFormScreen,ColorSwatchGrid,ChipPreview}.tsx`, `features/teams/hooks/{useTeamForm,useTeamMutations}.ts` (mutation keys from `qk`, invalidation per plan), routes `app/teams/new.tsx`, `app/teams/[id]/edit.tsx`; delete from the options sheet and the form.
- **Covers:** @AC-04.3.1, @AC-04.3.2, @AC-04.3.3, @AC-04.3.4, @AC-04.3.5.
- **Done when:** name boundaries 1/2/50/51; `TEAM_NAME_ALREADY_EXISTS` on the name field; hex validation + uppercase; preview chip uses the contrast rule; update invalidates `tasks.all`; delete requires confirmation and tasks remain (MSW state).

## T-004-14 — Build the Tasks list (global and per team)

- **Goal:** design S3/S6 list with infinite scroll and pull to refresh (filters in T-004-15).
- **Changes:** `src/features/tasks/components/{TasksListScreen,TaskRow,TaskRowSkeleton,TeamTasksHeader,ListFooter}.tsx` (`teamId?` from the `?teamId=` search param; header with a "show all tasks" action), `features/tasks/hooks/useTasksList.ts`, route `app/(tabs)/tasks.tsx`.
- **Covers:** @AC-04.2.2, @AC-04.4.1, @AC-04.4.2, @AC-04.4.3, @AC-04.4.4, @AC-04.4.5, @AC-04.4.6, @AC-04.8.1, @AC-04.8.4, @AC-04.9.1, @AC-04.9.2, @AC-04.9.3.
- **Done when:** the global list shows the 4 Background tasks (incl. the no-team task); a team list requests `teamId` and shows only its tasks; pages of 20 and end marker at 45; pull-to-refresh refetches page 1 keeping filters; overdue row shows text + icon; deleted team → not-found state; row a11y label as design §8.

## T-004-15 — Add task filters: status and search

- **Goal:** filter bar with per-list session filters.
- **Changes:** `src/features/tasks/filters.store.ts` (`byScope[scope].status: TaskStatus | 'ALL'`, default `'ALL'`, single-select; `search`), `features/tasks/components/{TaskFilterBar,StatusFilter}.tsx` (Todas · Pendente · Em andamento · Concluída), debounced search via `useDebouncedValue`, filtered empty state with "Limpar filtros".
- **Covers:** @AC-04.5.1, @AC-04.5.2, @AC-04.5.4, @AC-04.5.5.
- **Done when:** status combined with `teamId` (outline examples); `'ALL'` sends no `status` and any other value sends exactly one; fast typing produces one request (fake timers, MSW counter); search trimmed and ≤ 100; per-scope filters kept across navigation; reset after restart and on sign-out.

## T-004-16 — Build task detail with quick actions

- **Goal:** design S7: detail, status change, delete with confirmation; long-press status from the list.
- **Changes:** `src/features/tasks/components/{TaskDetailScreen,StatusQuickActions,StatusSheet,TaskMeta}.tsx`, `features/tasks/hooks/{useTaskDetail,useChangeTaskStatus,useDeleteTask}.ts` (mutation keys `['tasks','changeStatus']`, `['tasks','delete']`), route `app/tasks/[id].tsx`; long-press on `TaskRow` opens `StatusSheet`.
- **Covers:** @AC-04.6.1, @AC-04.6.2, @AC-04.6.3, @AC-04.6.4, @AC-04.6.5, @AC-04.6.6, @AC-04.6.7, @AC-04.8.3 (detail shows all chips).
- **Done when:** detail renders instantly from the list cache; status change sends `PATCH` and updates detail + invalidates lists; same status sends nothing; delete confirm → back + toast + gone from lists; cancel keeps; server error → previous status + mapped toast; `TASK_NOT_FOUND` → not-found state.

## T-004-17 — Build the create/edit task form

- **Goal:** design S8/S9 with validation and server-error mapping.
- **Changes:** `src/features/tasks/components/{TaskFormScreen,TeamPicker,StatusField}.tsx`, `features/tasks/hooks/{useTaskForm,useSaveTask}.ts`, routes `app/tasks/new.tsx` (`?teamId`), `app/tasks/[id]/edit.tsx`.
- **Covers:** @AC-04.7.1, @AC-04.7.2, @AC-04.7.3, @AC-04.7.4, @AC-04.7.5, @AC-04.7.6, @AC-04.7.7, @AC-04.7.8, @AC-04.9.6, @AC-04.15.2 (stack-guard test: every form hook under `src/features/**` uses `useForm` with `zodResolver`).
- **Done when:** title boundaries (2, padded 2, 3, 120, 121); error clears on valid input; description capped at 2000; 10-team limit; past-date hint; team preselected from a team list; edit preload; edit after a change elsewhere saves (last write wins); `UNKNOWN_TEAMS` removes ids and keeps input; dirty cancel asks; double press sends one `POST` (MSW counter).

## T-004-18 — Harden error handling and empty/loading states

- **Goal:** close every cell of the design state matrix.
- **Changes:** state-matrix suite `tests/state-matrix.test.tsx` (each screen × state), `RATE_LIMITED` toast with seconds, `ROUTE_NOT_FOUND` copy, missing error mappings fixed.
- **Covers:** @AC-04.9.1, @AC-04.9.2, @AC-04.9.3, @AC-04.9.4, @AC-04.9.5.
- **Done when:** the matrix in design §7 is fully green; the error outline examples pass.

## T-004-19 — Add Maestro flows for the main journeys

- **Goal:** prove the brief's mobile journeys end to end against the seeded API (run locally, outside the CI gate).
- **Changes:** `apps/mobile/tests/maestro/{config.yaml,auth.yaml,filter-by-team.yaml,task-crud.yaml,validation.yaml}`, missing `testID`s, script `pnpm --filter @hitss/mobile e2e`, notes for Expo Go (`openLink` to the Expo URL).
- **Covers:** @AC-04.1.2, @AC-04.2.2, @AC-04.4.1, @AC-04.6.2, @AC-04.6.4, @AC-04.7.1, @AC-04.7.2, @AC-04.8.1.
- **Done when:** flows pass locally twice in a row after a DB reset, using seeded names and no coordinates; the result is noted in the M6 PR.

## T-004-20 — Document running the app on a device

- **Goal:** an evaluator runs the app against `docker compose up` without guessing.
- **Changes:** `apps/mobile/README.md` (prerequisites, `.env` setup, LAN IP / emulator options, WSL2 note, demo credentials `demo@teams-tasks.dev`, scripts, troubleshooting the network error).
- **Covers:** —
- **Done when:** a fresh clone following only the README reaches the tasks list in Expo Go on a phone on the same Wi-Fi.

## T-004-21 — Build the sign-up screen (COULD)

- **Goal:** design S2 (seeded demo users cover the MUST journeys).
- **Changes:** `src/features/auth/components/SignUpScreen.tsx`, `features/auth/hooks/useSignUp.ts` (rhf + zod), route `app/(auth)/sign-up.tsx`, "Criar conta" link on Sign in.
- **Covers:** @AC-04.13.1.
- **Done when:** success stores the token and navigates; password boundaries 7/8/128/129; email taken on the field for `USER_ALREADY_EXISTS` and `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`; submitting disables inputs.

## T-004-22 — Add task sort (COULD)

- **Goal:** sort sheet for task lists; until it lands, lists use the API default order.
- **Changes:** `filters.store.ts` `sort` field, `features/tasks/components/SortSheet.tsx`, sort button in `TaskFilterBar`.
- **Covers:** @AC-04.14.1.
- **Done when:** each option maps to the API value; sort is kept per scope and reset with the other filters.

## T-004-23 — Add theme switching (COULD)

- **Goal:** Sistema / Claro / Escuro choice in Settings, kept after restart (US-04.10). Until it lands the theme follows the system.
- **Changes:** a persisted preference over the `StorageAdapter` (Zustand + immer + persist), `ThemeProvider` calls NativeWind `colorScheme.set`, theme row in `SettingsScreen`.
- **Covers:** @AC-04.10.1, @AC-04.10.2.
- **Done when:** `system` follows `Appearance` changes; Claro/Escuro switch the whole app immediately; the choice persists (memory adapter).

## T-004-25 — Harden accessibility (COULD)

- **Goal:** the full a11y checklist of design §8 beyond the MUST baseline (US-04.12).
- **Changes:** 200 % font-scale checks of key screens, static Skeleton when reduce motion is on, focus management after modal close, live-region announcements, a walk test over every pressable.
- **Covers:** @AC-04.12.1, @AC-04.12.3, @AC-04.12.4, @AC-04.12.5 (full checks).
- **Done when:** the walk test asserts label + role + 44 pt on every screen; no truncation at 200 %; reduced motion disables decorative animation.
