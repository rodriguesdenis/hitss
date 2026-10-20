# ADR-0010 — React Query for server state, Zustand + immer for local state

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, react-native-expo-specialist

## Context

The brief requires React Query for server state. The app also has **client-only** state: the active task filters (team, statuses, search, sort), user preferences (theme, language), and sync metadata (last successful sync, whether the offline banner was dismissed). Mixing these into one store — or copying server data into a client store — is the most common source of stale-data bugs in React apps.

## Decision drivers

- Clear ownership: every piece of state has exactly one home.
- Caching, deduplication, background refetch, retries, offline pause/resume and optimistic updates for server data without custom code.
- Minimal boilerplate for small local stores; ergonomic immutable updates.
- Persistable preferences; testable outside React.

## Considered options

### 1. TanStack Query (server) + Zustand with immer (local) (chosen)

- **+** React Query is the de-facto server-cache library; orval generates its hooks ([ADR-0008](0008-class-validator-dtos-and-generated-client.md)); built-in `onlineManager`, paused mutations and persistence ([ADR-0012](0012-offline-first-and-optimistic-updates.md)).
- **+** Zustand: tiny API, no provider, selectors avoid re-renders; `immer` middleware allows readable "mutating" updates for nested filter state; `persist` middleware for preferences.
- **−** Two libraries to learn (both small).

### 2. Redux Toolkit + RTK Query

- **+** One ecosystem for both kinds of state; DevTools.
- **−** The brief mandates React Query; RTK Query would duplicate it. Redux for a handful of local fields is heavyweight (slices, store setup, provider).

### 3. Jotai

- **+** Atomic, fine-grained, minimal.
- **−** Atom graphs for filters + preferences are less discoverable than a few named stores; persistence and immer integrations are add-ons. Viable, but Zustand's store-per-concern maps better to our features.

### 4. React Context + `useReducer`

- **+** No dependency.
- **−** Every consumer re-renders on any change unless contexts are split carefully; persistence and devtools are manual.

## Decision outcome

**Server state = React Query only.**

- `QueryClient` defaults: `staleTime` 30 s for lists, `gcTime` 24 h (needed for persistence), `retry` with exponential backoff except on 4xx, `networkMode: "offlineFirst"`.
- **Query keys:** orval's generated key helpers (`getListTasksQueryKey(params)`) wrapped by a small factory in `shared/query/keys.ts` exposing invalidation scopes (`taskKeys.all`, `taskKeys.lists()`, `taskKeys.detail(id)`, `teamKeys.all`).
- **Invalidation matrix:** task mutations invalidate task lists + detail + team lists (for `taskCount`); team mutations invalidate team lists, and team rename/recolor/delete also invalidate task lists (embedded chips).
- Feature hooks (`useChangeTaskStatus`) wrap generated hooks to add optimistic updates and invalidation; screens never call `queryClient` directly.

**Local UI state = Zustand + immer.**

| Store               | Contents                                                                                                                       | Persisted                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `filters.store`     | `statuses`, `search` (debounced), `sort`. `teamId` comes from the route (URL state, [ADR-0009](0009-expo-and-expo-router.md)). | No (session only)             |
| `preferences.store` | `theme: system \| light \| dark`, `language: pt \| en`                                                                         | Yes, through `StorageAdapter` |
| `sync.store`        | `lastSyncedAt`, `offlineBannerDismissed`                                                                                       | Yes                           |

**Hard rule:** server data (tasks, teams, session user) is **never** mirrored into Zustand. Derived values (pending mutation count, online status) are read from React Query (`useIsMutating`, `onlineManager`) instead of duplicated.

## Consequences

**Positive**

- No synchronization bugs between a client store and the cache; React Query is the only server-data truth.
- Stores are plain functions, unit-testable without rendering.
- Filters drive query keys, so changing a filter automatically fetches/serves the right cached list.

**Negative**

- Developers must know which bucket a value belongs to; documented here and checked in review.

**Neutral**

- Form state belongs to react-hook-form (brief), a third, short-lived bucket scoped to a screen.

## Links

- [ADR-0012 — Offline-first](0012-offline-first-and-optimistic-updates.md)
- TanStack Query: https://tanstack.com/query/latest · Zustand: https://zustand.docs.pmnd.rs
