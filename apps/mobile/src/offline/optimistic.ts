import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query';

export type Entity = { id: string };

export type ListPage<T> = {
  data: T[];
  meta: { total: number; limit: number; offset: number; hasNextPage: boolean };
};

export type Lists<T> = InfiniteData<ListPage<T>>;

export type Root = 'tasks' | 'teams';

export type ListPosition<T> = {
  queryKey: QueryKey;
  page: number;
  index: number;
  item: T | null;
};

export type EntitySnapshot<T> = {
  id: string;
  lists: ListPosition<T>[];
  detail: { data: T } | null;
};

const listsKey = (root: Root) => [root, 'list'] as const;
const detailKey = (root: Root, id: string) => [root, 'detail', id] as const;

function listQueries<T>(queryClient: QueryClient, root: Root) {
  return queryClient
    .getQueryCache()
    .findAll({ queryKey: listsKey(root) })
    .map((query) => ({
      queryKey: query.queryKey,
      params: (query.queryKey[2] ?? {}) as Record<string, unknown>,
      data: query.state.data as Lists<T> | undefined,
    }));
}

function withPages<T>(
  data: Lists<T>,
  map: (page: ListPage<T>, index: number) => ListPage<T>,
): Lists<T> {
  return { ...data, pages: data.pages.map(map) };
}

function withoutId<T extends Entity>(data: Lists<T>, id: string): Lists<T> {
  const present = data.pages.some((page) =>
    page.data.some((item) => item.id === id),
  );
  if (!present) {
    return data;
  }
  return withPages(data, (page) => ({
    data: page.data.filter((item) => item.id !== id),
    meta: { ...page.meta, total: Math.max(0, page.meta.total - 1) },
  }));
}

function withItemAt<T extends Entity>(
  data: Lists<T>,
  item: T,
  pageIndex: number,
  index: number,
): Lists<T> {
  return withPages(data, (page, current) => {
    const data = current === pageIndex ? [...page.data] : page.data;
    if (current === pageIndex) {
      data.splice(Math.min(Math.max(index, 0), data.length), 0, item);
    }
    return { data, meta: { ...page.meta, total: page.meta.total + 1 } };
  });
}

export async function cancelRoot(
  queryClient: QueryClient,
  root: Root,
): Promise<void> {
  await queryClient.cancelQueries({ queryKey: [root] });
}

export function snapshotEntity<T extends Entity>(
  queryClient: QueryClient,
  root: Root,
  id: string,
): EntitySnapshot<T> {
  const lists = listQueries<T>(queryClient, root).flatMap(
    ({ queryKey, data }) => {
      if (!data) {
        return [];
      }
      for (const [page, { data: items }] of data.pages.entries()) {
        const index = items.findIndex((item) => item.id === id);
        if (index >= 0) {
          return [{ queryKey, page, index, item: items[index] ?? null }];
        }
      }
      return [{ queryKey, page: 0, index: -1, item: null }];
    },
  );
  const detail =
    queryClient.getQueryData<{ data: T }>(detailKey(root, id)) ?? null;
  return { id, lists, detail };
}

export function restoreEntity<T extends Entity>(
  queryClient: QueryClient,
  root: Root,
  snapshot: EntitySnapshot<T>,
): void {
  for (const { queryKey, page, index, item } of snapshot.lists) {
    queryClient.setQueryData<Lists<T>>(queryKey, (data) => {
      if (!data) {
        return data;
      }
      const cleared = withoutId(data, snapshot.id);
      return item ? withItemAt(cleared, item, page, index) : cleared;
    });
  }
  if (snapshot.detail) {
    queryClient.setQueryData(detailKey(root, snapshot.id), snapshot.detail);
  } else {
    queryClient.removeQueries({
      queryKey: detailKey(root, snapshot.id),
      exact: true,
    });
  }
}

export function updateInLists<T extends Entity>(
  queryClient: QueryClient,
  root: Root,
  update: (item: T, params: Record<string, unknown>) => T | null,
): void {
  for (const { queryKey, params, data } of listQueries<T>(queryClient, root)) {
    if (!data) {
      continue;
    }
    let removed = 0;
    let changed = false;
    const pages = data.pages.map((page) => {
      const items = page.data.flatMap((item) => {
        const next = update(item, params);
        if (next !== item) {
          changed = true;
        }
        if (next === null) {
          removed += 1;
          return [];
        }
        return [next];
      });
      return { ...page, data: items };
    });
    if (changed) {
      queryClient.setQueryData<Lists<T>>(queryKey, {
        ...data,
        pages: pages.map((page) => ({
          ...page,
          meta: { ...page.meta, total: Math.max(0, page.meta.total - removed) },
        })),
      });
    }
  }
}

export function insertInLists<T extends Entity>(
  queryClient: QueryClient,
  root: Root,
  item: T,
  accepts: (params: Record<string, unknown>) => boolean,
): void {
  for (const { queryKey, params, data } of listQueries<T>(queryClient, root)) {
    if (!data || !accepts(params)) {
      continue;
    }
    queryClient.setQueryData<Lists<T>>(
      queryKey,
      withItemAt(withoutId(data, item.id), item, 0, 0),
    );
  }
}

export function removeFromLists(
  queryClient: QueryClient,
  root: Root,
  id: string,
): void {
  for (const { queryKey, data } of listQueries<Entity>(queryClient, root)) {
    if (data) {
      queryClient.setQueryData(queryKey, withoutId(data, id));
    }
  }
}

export function setDetail<T>(
  queryClient: QueryClient,
  root: Root,
  id: string,
  update: (current: T | undefined) => T | undefined,
): void {
  queryClient.setQueryData<{ data: T }>(detailKey(root, id), (current) => {
    const next = update(current?.data);
    return next === undefined ? current : { data: next };
  });
}

export function replaceIdInLists<T extends Entity>(
  queryClient: QueryClient,
  root: Root,
  tempId: string,
  replacement: T,
): void {
  updateInLists<T>(queryClient, root, (item) =>
    item.id === tempId ? replacement : item,
  );
  const temp = queryClient.getQueryData<{ data: T }>(detailKey(root, tempId));
  queryClient.setQueryData(detailKey(root, replacement.id), {
    data: replacement,
  });
  if (temp) {
    queryClient.setQueryData(detailKey(root, tempId), { data: replacement });
  }
}
