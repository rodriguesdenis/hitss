# 005 — Tasks

Ordered; each task is one PR ([ADR-0017](../../architecture/adr/0017-conventional-commits-and-atomic-prs.md)). Requires 004 through T-004-16 (screens, mutation keys, toast store, `StorageAdapter`). Test-first: each task lands with the tests of the scenarios it covers.

| ID       | Task                                                                      | Depends on | Size | Branch                       |
| -------- | ------------------------------------------------------------------------- | ---------- | ---- | ---------------------------- |
| T-005-01 | Persist the query cache through the StorageAdapter                        | T-004-16   | M    | `feat/005-persisted-cache`   |
| T-005-02 | Wire connectivity and the offline banner                                  | 01         | S    | `feat/005-connectivity`      |
| T-005-03 | Register durable mutation defaults with serial scope and idempotency keys | 01         | M    | `feat/005-mutation-defaults` |
| T-005-04 | Make status change optimistic with rollback                               | 03         | M    | `feat/005-optimistic-status` |
| T-005-05 | Make task and team deletion optimistic with rollback                      | 03         | M    | `feat/005-optimistic-delete` |
| T-005-06 | Make creation optimistic with temporary ids                               | 03         | M    | `feat/005-optimistic-create` |
| T-005-07 | Make task and team edits optimistic with the version chain                | 06         | M    | `feat/005-optimistic-edit`   |
| T-005-08 | Handle conflicts and rejections on replay                                 | 04, 05, 07 | M    | `feat/005-replay-conflicts`  |
| T-005-09 | Show pending-sync indicators and the sync summary                         | 04         | S    | `feat/005-pending-sync-ui`   |
| T-005-10 | Tie the queue to the session (401, sign-out, user switch)                 | 08         | S    | `feat/005-queue-session`     |
| T-005-11 | Add restart/replay integration suite and Maestro offline flow             | 10, 09     | M    | `test/005-offline-e2e`       |
| T-005-12 | Add an MMKV storage adapter for dev builds (COULD)                        | 01         | S    | `feat/005-mmkv-adapter`      |

## T-005-01 — Persist the query cache through the StorageAdapter

- **Goal:** last-seen data available offline and after restart, per user.
- **Changes:** `src/lib/offline/{storage-adapter,persister}.ts` (reuse 004 `src/lib/storage/` `StorageAdapter`; add `memoryAdapter` for tests), `src/providers/QueryProvider.tsx` → `PersistQueryClientProvider` (`maxAge` 24 h, `buster` with API contract hash, `shouldDehydrateQuery`), `gcTime` 24 h, `maxPages: 10` on infinite lists, `src/lib/offline/offline-store.ts` (ownerId), purge on sign-out.
- **Covers:** @AC-05.1.1, @AC-05.1.2, @AC-05.1.3, @AC-05.1.4, @AC-05.1.5.
- **Done when:** integration test: load lists → new QueryClient restored from the same memory adapter renders without placeholders and without network; 25-hour-old snapshot is discarded; buster mismatch discards; sign-out removes the key; different `ownerId` never restores another user's data.

## T-005-02 — Wire connectivity and the offline banner

- **Goal:** the app knows and shows when it is offline.
- **Changes:** `src/lib/offline/connectivity.ts` (`onlineManager` ↔ NetInfo, `focusManager` ↔ AppState, `useIsOnline`), `OfflineBanner` connected (offline / syncing / synced states, ≥ 1 s flap debounce), `refetchOnReconnect: false` + reconnect sequencing `resumePausedMutations().then(invalidateQueries)`; auth screens disable submit offline (BR-05.9).
- **Covers:** @AC-05.2.1, @AC-05.1.3 (auto-load on reconnect).
- **Done when:** component tests with mocked NetInfo: banner appears/disappears, `isInternetReachable: null` treated as online, flapping doesn't flicker (fake timers), queries resume after reconnect.

## T-005-03 — Register durable mutation defaults with serial scope and idempotency keys

- **Goal:** mutations survive restarts and replay in order.
- **Changes:** `src/lib/offline/mutation-defaults.ts` (`registerMutationDefaults(queryClient)` for all seven keys, without optimistic logic yet: `mutationFn` + `scope: { id: 'sync' }` + `networkMode: 'offlineFirst'` + `retry`/`retryDelay` with `Retry-After`, `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` retried), `shouldDehydrateMutation`, `onSuccess` resume in provider; screens' hooks refactored to `useMutation({ mutationKey })` + serializable variables with `idempotencyKey: randomUUID()` (expo-crypto) and `title`.
- **Covers:** @AC-05.6.2, @AC-05.6.3, @AC-05.6.4 (mechanism).
- **Done when:** integration test: 3 mutations offline → dehydrate → new client hydrate → online → MSW receives them in order, each once; retry with backoff on 503 (fake timers); `429` waits `Retry-After`; replayed POST with the same key returns the stored response (MSW idempotency handler) → one task.

## T-005-04 — Make status change optimistic with rollback

- **Goal:** status changes render in the same frame and revert on rejection.
- **Changes:** `src/lib/offline/optimistic/tasks.ts` (`applyStatus` across detail and every cached list page; remove from non-matching status-filtered lists; `completedAt` set/cleared), `tasks.changeStatus` defaults `onMutate`/`onError`/`onSuccess`, `cancelQueries` before writing; Undo from 004 enqueues another change.
- **Covers:** @AC-05.3.1, @AC-05.3.2, @AC-05.3.3, @AC-05.3.4, @AC-05.3.5.
- **Done when:** component test asserts new status before the delayed MSW response; 500 → previous status in detail and lists + `sync.rejected` toast; two changes offline end with the last one on the server; filtered list drops the task immediately.

## T-005-05 — Make task and team deletion optimistic with rollback

- **Goal:** deletions disappear immediately; already-deleted is success.
- **Changes:** `optimistic/tasks.ts#removeTask` (lists, detail, team `taskCount`), `optimistic/teams.ts#removeTeam` (team lists, chips in cached tasks, team task lists), defaults for `tasks.delete` / `teams.delete` with `404 → success`.
- **Covers:** @AC-05.4.1, @AC-05.4.2, @AC-05.4.3, @AC-05.4.4.
- **Done when:** tests: offline delete removes everywhere and is sent on reconnect; 500 restores at the original position; 404 on replay produces no toast; team delete strips chips.

## T-005-06 — Make creation optimistic with temporary ids

- **Goal:** created tasks and teams appear instantly; dependents wait for them.
- **Changes:** `optimistic/tasks.ts#insertTask`, `optimistic/teams.ts#insertTeam`, `src/lib/offline/resolve.ts#resolveId`, `offline-store.idMap`, `replaceId` across caches, `router.setParams` swap on the open detail, cancellation of dependents when a creation fails, queued-save toast for offline form submit.
- **Covers:** @AC-05.5.1, @AC-05.5.3, @AC-05.5.4, @AC-05.5.6.
- **Done when:** tests: temp task first in global + team lists; create → status change → delete on the same temp id syncs in order and ends with no task; detail opened on temp id keeps working after confirmation; task in a team created offline is sent with the real team id.

## T-005-07 — Make task and team edits optimistic with the version chain

- **Goal:** edits render instantly and consecutive own edits never self-conflict.
- **Changes:** `optimistic/tasks.ts#mergeTask` (including moving between team lists when `teamIds` change), `optimistic/teams.ts#mergeTeam` (embedded chips), `resolve.ts#resolveVersion`, `offline-store.versionMap`, `If-Match` from the resolved version for `PUT`/`DELETE` (status `PATCH` sends none, ADR-0015, but extends the chain).
- **Covers:** @AC-05.5.2, @AC-05.7.4.
- **Done when:** unit tests for version chains (v3→4→5); offline edit then status change then delete on the same task: edit sends `If-Match` 3, status sends none, delete sends `If-Match` 5 — all succeed; team rename updates chips in cached tasks immediately.

## T-005-08 — Handle conflicts and rejections on replay

- **Goal:** server wins, user is told, queue continues.
- **Changes:** `src/lib/offline/conflicts.ts#handleReplayError` (decision table in plan), refetch-and-compare for 412 (effect-already-present → success), 404 → remove + `sync.conflictDeleted`, 412 differing → server version + `sync.conflictChanged`, 400/422 → rollback + `sync.rejected {reason}`, deferred invalidation until scope idle.
- **Covers:** @AC-05.5.5, @AC-05.7.1, @AC-05.7.2, @AC-05.7.3, @AC-05.7.5.
- **Done when:** decision-table unit tests; integration tests reproduce each feature scenario of US-05.7 with MSW state mutated "by another device"; a conflict in the middle of the queue doesn't stop later changes.

## T-005-09 — Show pending-sync indicators and the sync summary

- **Goal:** users see what isn't confirmed yet.
- **Changes:** `src/lib/offline/usePendingSync.ts` (`useMutationState` → entity id set + count), `TaskRow`/`TeamCard`/detail badge, Tasks tab dot, Settings `sync.queueCount`/`settings.synced`, banner syncing/synced counts.
- **Covers:** @AC-05.2.2, @AC-05.2.3, @AC-05.2.4.
- **Done when:** component tests for badge presence/absence across pending → success, tab dot, Settings count, banner "syncing 2 changes…" → "All changes synced".

## T-005-10 — Tie the queue to the session (401, sign-out, user switch)

- **Goal:** pending changes never leak across users and survive re-authentication.
- **Changes:** `onUnauthenticated` keeps paused mutations (pauses scope), post-sign-in check of `ownerId` → resume or discard; Settings sign-out warning when pending; purge of cache, mutation cache and offline store on sign-out.
- **Covers:** @AC-05.6.5, @AC-05.6.6, @AC-05.1.5.
- **Done when:** integration tests: 401 during replay → same user signs in → change sent; different user → discarded, never sent (MSW asserts zero calls); sign-out warning with cancel keeps queue.

## T-005-11 — Add restart/replay integration suite and Maestro offline flow

- **Goal:** prove the offline journey end to end.
- **Changes:** `test/offline/restart-replay.test.tsx` (full feature Background, all US-05.6 scenarios), `apps/mobile/.maestro/offline.yaml` (airplane mode on Android emulator; documented manual step for iOS), README section "Testing offline".
- **Covers:** @AC-05.6.1, @AC-05.6.2, @AC-05.2.3 (E2E).
- **Done when:** the suite is green in CI; Maestro flow passes twice in a row on a fresh seed; server shows each change exactly once.

## T-005-12 — Add an MMKV storage adapter for dev builds (COULD)

- **Goal:** demonstrate the adapter seam with a faster engine without breaking Expo Go.
- **Changes:** `src/lib/offline/mmkv-adapter.ts` loaded lazily only when `EXPO_PUBLIC_STORAGE=mmkv`, dev-build instructions in README, ADR-0012 reference.
- **Covers:** —
- **Done when:** default run in Expo Go unaffected (no import of the native module); adapter passes the same `StorageAdapter` contract test suite as AsyncStorage/memory adapters.
