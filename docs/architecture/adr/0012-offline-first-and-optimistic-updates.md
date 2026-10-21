# ADR-0012 — Offline-first persistence (AsyncStorage adapter) and optimistic updates

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, react-native-expo-specialist

## Context

The persona works on unreliable mobile networks; status changes must feel instant and survive loss of connectivity (brief differential: offline-first, optimistic updates; brief suggests MMKV as an example). The app must also keep running in **Expo Go** ([ADR-0009](0009-expo-and-expo-router.md)), which excludes libraries with custom native modules such as `react-native-mmkv`.

## Decision drivers

- Lists and details readable offline after the first successful load, including after an app restart.
- Mutations made offline are queued, survive restarts and replay in order when back online.
- Instant feedback with correct rollback on server rejection (validation, 404, 412).
- Retried mutations must not create duplicates.
- Expo Go compatibility; storage engine swappable later.

## Considered options

### Persistence engine

| Option                            | Pros                                                                                                        | Cons                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **AsyncStorage** (chosen default) | Bundled in Expo Go; async API fits `createAsyncStoragePersister`; adequate for a cache of a few hundred KB. | Slower than MMKV; JSON serialization of the whole cache on throttled writes.                                  |
| **MMKV** (`react-native-mmkv`)    | Very fast synchronous key-value store; suggested by the brief.                                              | Requires a native module → needs a development build; **does not run in Expo Go**, which hurts "easy to run". |
| **expo-sqlite**                   | Queryable, durable, in Expo Go.                                                                             | Overkill for a key-value cache; schema management on device.                                                  |

### Sync strategy

| Option                                                                                    | Pros                                                                                                               | Cons                                                                  |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| **React Query persistence + paused mutations** (chosen)                                   | Built into TanStack Query (`persistQueryClient`, `onlineManager`, `resumePausedMutations`); no custom sync engine. | Last-write-wins semantics; ordering only within a mutation scope.     |
| **Local database as source of truth + sync engine** (WatermelonDB, PowerSync, Replicache) | Full offline CRUD with conflict resolution.                                                                        | Native modules or hosted services; backend changes; far beyond scope. |

## Decision outcome

**Storage abstraction**

```ts
interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
```

- `AsyncStorageAdapter` is the default; `MmkvStorageAdapter` is provided and selected by config when running a development build (`EXPO_PUBLIC_STORAGE=mmkv`). Only `src/shared/storage/` imports storage libraries (lint rule M5).
- The same adapter backs the React Query persister and Zustand `persist` middleware.

**Query cache persistence**

- `PersistQueryClientProvider` with `createAsyncStoragePersister({ storage: adapter, throttleTime: 1000 })`, `maxAge` 24 h, `buster` = app version + API contract hash (cache dropped when the contract changes).
- Only successful queries are dehydrated; the session token is never in the query cache (it lives in secure store, [ADR-0007](0007-better-auth.md)).
- Cache is cleared on sign-out.

**Online detection and paused mutations**

- `onlineManager.setEventListener` wired to `@react-native-community/netinfo`; `focusManager` wired to `AppState`.
- Mutations use `networkMode: "offlineFirst"`; when offline they are **paused** and dehydrated with the cache.
- Because functions cannot be persisted, every mutation is registered with `queryClient.setMutationDefaults(mutationKey, { mutationFn, onMutate, onError, onSettled })`, so rehydrated mutations know how to run. `onSuccess` of the persister calls `queryClient.resumePausedMutations()`.
- **One ordered queue (amended):** every offline-capable mutation shares a single `scope: { id: "sync" }`, so all mutations run serially in the order the user made them. Per-entity scopes (`task:<id>`) were rejected: a task created offline may reference a team also created offline, and edits across entities must replay in user order.
- **Temporary ids:** offline creates use `tmp-<uuid>` only in the cache; the client never sends ids it generated itself. When a create succeeds, the server id is recorded in an id map, and later queued mutations resolve `tmp-` ids through it before sending (e.g. a task's `teamIds`).

**Optimistic updates** (status change, delete, create)

1. `onMutate`: `cancelQueries` for affected keys, snapshot them, patch every cached list page and the detail (create inserts a temporary item with `id: "tmp-<uuid>"` and a `pending` flag).
2. `onError`: restore the snapshot and show a toast mapped from `ApiError.code` (e.g. `PRECONDITION_FAILED` → "This task changed elsewhere; refreshed").
3. `onSettled`: invalidate the affected keys so the server state wins.

**Duplicate safety:** creates (`POST`) carry an `Idempotency-Key` generated **when the mutation is created** and stored in its variables, so a replay after reconnect or restart reuses the same key and the server returns the original response ([ADR-0019](0019-idempotency-keys.md)). The key is sent on **`POST` only**: `PUT`, `PATCH` and `DELETE` are idempotent by HTTP semantics and protected by `If-Match`. A replayed `DELETE` that gets `404` (already deleted by an earlier attempt) is treated as **success** by the client.

**Conflicts:** offline edits send `If-Match` with the version they were based on; a `412` rolls back and refetches ([ADR-0015](0015-optimistic-concurrency.md)). Quick status changes omit `If-Match` (last write wins is the desired behavior for a toggle).

## Consequences

**Positive**

- App opens with data offline; status taps are instant; queued work survives restarts.
- No custom sync engine; behavior is standard TanStack Query and well documented.
- Swapping to MMKV is a config change in a dev build.

**Negative**

- AsyncStorage is slower than MMKV for large caches; acceptable for per-user volumes, measured in Spec 005.
- Offline creation shows temporary ids until sync; navigating to a temporary task's detail is limited to cached data.
- **Head-of-line blocking:** with one queue, a mutation waiting on network or retries holds everything behind it. Transient errors (network, 5xx, `409 IDEMPOTENCY_REQUEST_IN_PROGRESS`, `429`) are retried with bounded backoff. A permanently failed mutation (4xx) is rolled back and surfaced to the user, and the queue **continues**; mutations depending on it (e.g. referencing its `tmp-` id) are marked failed too, instead of being sent.
- `setMutationDefaults` registration must happen before cache restoration (done in `shared/query/mutation-defaults.ts` at startup).

**Neutral**

- Full offline-first with conflict merging (CRDTs, sync engines) is listed as a production option, not a goal.

## Links

- [Spec 005 — Offline sync](../../specs/005-offline-sync/spec.md)
- [ADR-0010 — React Query + Zustand](0010-react-query-and-zustand-immer.md)
- TanStack Query persistence: https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient
