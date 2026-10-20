# ADR-0006 — Offset pagination (vs cursor)

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, nestjs-specialist

## Context

Both list endpoints (`GET /teams`, `GET /tasks`) must return "pagination metadata" (brief). Task lists combine filters (`teamId`, `status`, `search`) with user-selectable sort (`createdAt`, `updatedAt`, `dueDate`, `title`, `status`). Each user has tens to low thousands of rows. The app shows an infinite list and a count ("12 tasks").

## Decision drivers

- Brief explicitly expects metadata such as total/pagination.
- Simple to call by hand (`?limit=20&offset=40`) and to generate hooks for.
- Works with arbitrary, user-chosen sort fields including nullable `dueDate`.
- Stable ordering: the same row must not appear on two pages when values tie.
- Acceptable performance at expected volumes.

## Considered options

### 1. Offset/limit with `total` (chosen)

- **+** Directly provides `total`, `hasNextPage`, "page N of M".
- **+** Any sort combination works; trivial SQL (`ORDER BY … LIMIT … OFFSET …`).
- **+** Easy for `useInfiniteQuery` (`getNextPageParam = offset + limit` when `hasNextPage`).
- **−** Cost grows with offset (Postgres scans and discards skipped rows).
- **−** Concurrent inserts/deletes can shift items between pages (duplicates or skips during scrolling).
- **−** `COUNT(*)` on every request.

### 2. Cursor (keyset) pagination

- **+** Constant cost per page; no shifting under concurrent writes.
- **−** No cheap `total`; the brief's metadata would need a separate count anyway.
- **−** Cursor must encode every sort key + `id`; nullable `dueDate` with "nulls last" and multi-field sorts make the `WHERE (a, b) > (x, y)` predicate intricate.
- **−** Opaque cursors are harder to demonstrate with cURL.

### 3. Page number/size (`?page=3&pageSize=20`)

- **+** Familiar for UIs with numbered pages.
- **−** Same engine as offset with less flexibility; mobile infinite scroll does not need page numbers.

## Decision outcome

**Offset pagination** with `limit` (default 20, 1–100) and `offset` (≥ 0), returning:

```json
{ "meta": { "total": 42, "limit": 20, "offset": 20, "hasNextPage": true } }
```

- **Stable sort:** every `ORDER BY` ends with `id` as a tiebreaker (e.g. `due_date ASC NULLS LAST, id ASC`), so pages are deterministic for a fixed dataset.
- **Count:** data and `total` are fetched in one transaction (`findMany` + `count` with identical `where`), both served by the partial indexes in the [data model](../data-model.md#indexes-and-why).
- **Validation:** a shared `PaginationQueryDto` (class-validator) enforces bounds; `sort` is whitelisted per endpoint, so arbitrary columns can never reach SQL.
- **Client:** generated `useInfiniteQuery` hooks derive the next `offset` from `meta`; optimistic updates patch cached pages in place ([ADR-0012](0012-offline-first-and-optimistic-updates.md)).

## Consequences

**Positive**

- Meets the brief literally; simplest contract to read and test.
- Sort flexibility without cursor-encoding complexity.

**Negative**

- Possible duplicates/skips if the list changes while scrolling; mitigated in the app by de-duplicating by `id` when flattening pages and by invalidating lists after mutations.
- Deep offsets get slower; irrelevant at per-user volumes (tens to thousands of rows), noted for production.

**Neutral / evolution**

- **Cursor pagination** is the production evolution for large datasets: add `?cursor=` alongside offset in `v1` (additive), keep `total` optional (`?includeTotal=true`), and deprecate offset in `v2` if needed.

## Links

- [API contracts — pagination](../api-contracts.md#pagination-sorting-search)
- [ADR-0005 — REST + envelopes](0005-rest-openapi-and-response-envelope.md)
- Use the Index, Luke — paging: https://use-the-index-luke.com/no-offset
