# 005 — Tasks

All tasks ship in **one milestone PR** with one or more atomic commits per task (Conventional Commits, scope `mobile`). Test-first: each task lands with the tests of the scenarios it covers. `src/offline` holds only generic helpers; each feature registers its own durable mutation logic. Everything runs in Expo Go (AsyncStorage, NetInfo, AppState).

## Milestone

| Milestone  | Tasks                   | Owner | Branch                | Depends on                                                   |
| ---------- | ----------------------- | ----- | --------------------- | ------------------------------------------------------------ |
| M5 offline | T-005-01..11 (all MUST) | Forge | `feat/005-m5-offline` | M2 (004); runs in parallel with M4, rebased on it at the end |

| ID       | Task                                                                    | Priority | Depends on   |
| -------- | ----------------------------------------------------------------------- | -------- | ------------ |
| T-005-01 | Persist the query cache through the StorageAdapter                      | MUST     | T-004-05     |
| T-005-02 | Wire connectivity and the offline banner                                | MUST     | 01, T-004-08 |
| T-005-03 | Register durable mutation defaults in one ordered queue                 | MUST     | 01           |
| T-005-04 | Make status change optimistic with rollback                             | MUST     | 03, T-004-16 |
| T-005-05 | Make task and team deletion optimistic with rollback                    | MUST     | 03           |
| T-005-06 | Make creation optimistic with temporary ids                             | MUST     | 03, T-004-17 |
| T-005-07 | Make task and team edits optimistic                                     | MUST     | 06           |
| T-005-08 | Discard rejected changes on replay with a warning                       | MUST     | 04, 05, 07   |
| T-005-09 | Show pending-sync indicators and the sync summary                       | MUST     | 04           |
| T-005-10 | Tie the queue to the session (session gate, 401, sign-out, user switch) | MUST     | 08, T-004-11 |
| T-005-11 | Add restart/replay integration suite and Maestro offline flow           | MUST     | 10, 09       |
| T-005-12 | ~~MMKV storage adapter~~ — dropped: needs a dev build, not Expo Go      | —        | —            |

## T-005-01 — Persist the query cache through the StorageAdapter

- **Status:** done
- **Goal:** last-seen data available offline and after restart, per user.
- **Changes:** `src/offline/persister.ts` (over `src/lib/storage.ts`; memory adapter for tests), `PersistQueryClientProvider` (`maxAge` 24 h, `buster` with the API contract hash), `gcTime` 24 h, `maxPages: 10`, `src/offline/sync.store.ts` (`ownerId`).
- **Covers:** @AC-05.1.1, @AC-05.1.2, @AC-05.1.3, @AC-05.1.4, @AC-05.1.5.
- **Done when:** integration test: load lists → a new QueryClient restored from the same memory adapter renders without placeholders and without network; a 25-hour-old snapshot and a buster mismatch are discarded; a different `ownerId` never restores another user's data; the persisted value contains no token.

## T-005-02 — Wire connectivity and the offline banner

- **Status:** done
- **Goal:** the app knows and shows when it is offline.
- **Changes:** `src/offline/network.ts` (`onlineManager` ↔ NetInfo, `focusManager` ↔ AppState, `useIsOnline`), `OfflineBanner` connected (offline / syncing / synced, ≥ 1 s flap debounce), `refetchOnReconnect: false` + `resumePausedMutations().then(invalidateQueries)`; sign-in submit disabled offline (BR-05.9).
- **Covers:** @AC-05.2.1, @AC-05.1.3 (auto-load on reconnect).
- **Done when:** component tests with mocked NetInfo: banner appears/disappears, `isInternetReachable: null` counts as online, flapping does not flicker (fake timers), queries resume after reconnect.

## T-005-03 — Register durable mutation defaults in one ordered queue

- **Status:** done
- **Goal:** mutations survive restarts and replay in the user's order.
- **Changes:** `src/offline/durable-mutation.ts` (`defineDurableMutation`), `features/tasks/mutations.ts` `registerTaskMutationDefaults` and `features/teams/mutations.ts` `registerTeamMutationDefaults` (called in `app/_layout.tsx` before restore) for the seven keys, without optimistic logic yet: `mutationFn` + `scope: { id: 'sync' }` + `networkMode: 'offlineFirst'` + `retry`/`retryDelay` for network, timeout, 5xx and `429` (honoring `retryAfter`); feature hooks refactored to `useMutation({ mutationKey })` with serializable variables carrying `title`.
- **Covers:** @AC-05.6.2, @AC-05.6.3, @AC-05.6.4 (mechanism).
- **Done when:** integration test: 3 mutations offline → dehydrate → new client hydrates → online → MSW receives them in order; backoff on `503` (fake timers); `429` waits `Retry-After`; a resent `PUT` ends in the same server state.

## T-005-04 — Make status change optimistic with rollback

- **Status:** done
- **Goal:** status changes render in the same frame and revert on rejection.
- **Changes:** list-page helpers in `src/offline/optimistic.ts`, `applyStatus` in `features/tasks/mutations.ts` (detail and every cached list page; drop from non-matching status-filtered lists; `completedAt` set/cleared), `cancelQueries` before writing.
- **Covers:** @AC-05.3.1, @AC-05.3.2, @AC-05.3.3, @AC-05.3.4, @AC-05.3.5.
- **Done when:** component test asserts the new status before the delayed MSW response; rejection → previous status in detail and lists + warning toast; two changes offline end with the last one on the server; a filtered list drops the task immediately.

## T-005-05 — Make task and team deletion optimistic with rollback

- **Status:** done
- **Goal:** deletions disappear immediately; already deleted is a success.
- **Changes:** `removeTask` (lists, detail, team `taskCount`), `removeTeam` (team lists, chips in cached tasks, team task lists), `404 → success` on `tasks.delete` / `teams.delete`.
- **Covers:** @AC-05.4.1, @AC-05.4.2, @AC-05.4.3, @AC-05.4.4.
- **Done when:** offline delete removes everywhere and is sent on reconnect; a rejection restores the original position; `404` on replay shows no toast; team delete strips chips.

## T-005-06 — Make creation optimistic with temporary ids

- **Status:** done
- **Goal:** created tasks and teams appear instantly; dependants wait for them.
- **Changes:** `insertTask`, `insertTeam`, `src/offline/temp-ids.ts` (`tmp-<uuid>` via `expo-crypto`, `resolveId`), `sync.store` `idMap` / `failedTmpIds`, `replaceId` across caches, `router.setParams` on the open detail, dependants of a failed creation failed unsent, queued-save toast on offline submit.
- **Covers:** @AC-05.5.1, @AC-05.5.3, @AC-05.5.4, @AC-05.5.6.
- **Done when:** temp task first in global and team lists; create → status change → delete on the same temp id syncs in order and ends with no task; a detail opened on a temp id keeps working after confirmation; a task in a team created offline is sent with the real team id; a rejected team creation fails its dependent task unsent (zero MSW calls) while an unrelated later change is sent; no request ever contains a `tmp-` id.

## T-005-07 — Make task and team edits optimistic

- **Status:** done
- **Goal:** edits render instantly; the last write wins.
- **Changes:** `mergeTask` (moves between team lists when `teamIds` change), `mergeTeam` (embedded chips).
- **Covers:** @AC-05.5.2, @AC-05.7.1, @AC-05.7.4.
- **Done when:** offline edit, then status change, then delete of the same task are all sent in order and succeed; a team rename updates chips in cached tasks immediately; an edit made elsewhere is overwritten by the replay with no message.

## T-005-08 — Discard rejected changes on replay with a warning

- **Status:** done
- **Goal:** a change that can no longer be applied is reverted, explained and dropped; the queue continues.
- **Changes:** `src/offline/replay-errors.ts#classifyReplayError` (decision table in the plan): `404` on status/edit → remove from caches + "“<title>” foi excluída em outro lugar."; `400`/`409`/`422` → rollback + "Não foi possível salvar “<title>”: <reason>"; both discard the mutation; invalidation deferred until the scope is idle.
- **Covers:** @AC-05.5.5, @AC-05.7.2, @AC-05.7.3, @AC-05.7.5.
- **Done when:** decision-table unit tests; integration tests reproduce each US-05.7 scenario with MSW state changed "by another device"; a discarded change in the middle of the queue does not stop later ones.

## T-005-09 — Show pending-sync indicators and the sync summary

- **Status:** done
- **Goal:** users see what is not confirmed yet.
- **Changes:** `src/offline/use-pending-sync.ts` (`useMutationState` → entity id set + count), row/card/detail badge, Tasks tab dot, Settings count, banner syncing/synced counts.
- **Covers:** @AC-05.2.2, @AC-05.2.3, @AC-05.2.4.
- **Done when:** component tests for the badge across pending → success, tab dot, Settings count, banner "De volta online — sincronizando 2 alterações…" → "Todas as alterações sincronizadas".

## T-005-10 — Tie the queue to the session (session gate, 401, sign-out, user switch)

- **Status:** done
- **Goal:** pending changes never leak across users and survive re-authentication.
- **Changes:** `src/offline/session-gate.ts` (`createSessionGate({ getSessionUserId })`, source injected from `features/auth` by `app/_layout.tsx`; `onlineManager` forced offline at startup and after `401` until the session user id equals `ownerId`, otherwise discard queue and cache before rendering or sending); `onUnauthenticated` deletes the token and clears queries only; Settings sign-out warning when pending; sign-out awaits `authClient.signOut()`, token deletion and `persister.removeClient()`, then clears caches, queue and `sync.store` before navigating.
- **Covers:** @AC-05.6.5, @AC-05.6.6, @AC-05.1.5.
- **Done when:** `401` during replay → queries cleared, mutations kept → same user signs in → change sent; different user → discarded before resume, zero MSW calls; restart with an expired session sends nothing until sign-in; NetInfo online events before the gate passes trigger no request; cancel on the sign-out warning keeps the queue; after sign-out AsyncStorage and SecureStore hold nothing of the user.

## T-005-11 — Add restart/replay integration suite and Maestro offline flow

- **Status:** done
- **Goal:** prove the offline journey end to end.
- **Changes:** `tests/offline/restart-replay.test.tsx` (feature Background, all US-05.6 scenarios), `tests/maestro/offline.yaml` (airplane mode on an Android emulator; manual step documented for iOS), README section "Testing offline".
- **Covers:** @AC-05.6.1, @AC-05.6.2, @AC-05.2.3 (E2E).
- **Done when:** the suite is green in CI; the Maestro flow passes locally twice in a row on a fresh seed (result noted in the PR).
