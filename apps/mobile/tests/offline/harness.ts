import {
  tasksList,
  teamsList,
  type TaskResponseDto,
  type TasksListParams,
  type TeamResponseDto,
  type TeamsListParams,
} from '@hitss/api-client';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { qk } from '@/lib/query-keys';
import { setSyncAllowed, useSyncStore } from '@/offline';
import { startNetwork } from '@/offline/network';
import { hideToast, useToastStore } from '@/ui';

import { API_URL } from '../fixtures';
import { setNetwork } from '../mocks/netinfo';
import { createTestQueryClient } from '../renderWithProviders';
import { server } from '../server';

type Page<T> = { data: T[] };

const stops: (() => void)[] = [];
const clients: QueryClient[] = [];

export const writes: string[] = [];

export function setupOffline() {
  beforeEach(() => {
    writes.length = 0;
    hideToast();
    useSyncStore.setState({
      ownerId: 'user-marina',
      idMap: {},
      failedTmpIds: [],
    });
    stops.push(startNetwork());
    setSyncAllowed(true);
    server.events.on('request:start', ({ request }) => {
      if (request.method !== 'GET') {
        writes.push(`${request.method} ${new URL(request.url).pathname}`);
      }
    });
  });
  afterEach(() => {
    server.events.removeAllListeners();
    stops.splice(0).forEach((stop) => stop());
    clients.splice(0).forEach((client) => {
      client.unmount();
      client.clear();
    });
    setSyncAllowed(false);
  });
}

export function newClient(): QueryClient {
  const client = createTestQueryClient();
  client.mount();
  clients.push(client);
  return client;
}

export async function seedTasks(client: QueryClient, params: TasksListParams) {
  client.setQueryData(qk.tasks.list(params), {
    pages: [await tasksList(params)],
    pageParams: [0],
  });
}

export async function seedTeams(client: QueryClient, params: TeamsListParams) {
  client.setQueryData(qk.teams.list(params), {
    pages: [await teamsList(params)],
    pageParams: [0],
  });
}

export function listed<T extends { id: string }>(
  client: QueryClient,
  key: readonly unknown[],
): T[] {
  const data = client.getQueryData<InfiniteData<Page<T>>>(key);
  return data?.pages.flatMap((page) => page.data) ?? [];
}

export const taskTitles = (client: QueryClient, params: TasksListParams) =>
  listed<TaskResponseDto>(client, qk.tasks.list(params)).map((t) => t.title);

export const teamNames = (client: QueryClient, params: TeamsListParams) =>
  listed<TeamResponseDto>(client, qk.teams.list(params)).map((t) => t.name);

export function goOffline() {
  server.use(
    http.post(`${API_URL}/api/v1/*`, () => HttpResponse.error()),
    http.put(`${API_URL}/api/v1/*`, () => HttpResponse.error()),
    http.patch(`${API_URL}/api/v1/*`, () => HttpResponse.error()),
    http.delete(`${API_URL}/api/v1/*`, () => HttpResponse.error()),
  );
  setNetwork({ isConnected: false });
}

export async function goOnline(
  client: QueryClient,
  ...handlers: Parameters<typeof server.use>
) {
  server.resetHandlers();
  server.use(...handlers);
  setNetwork({ isConnected: true });
  await client.resumePausedMutations();
  await settle();
}

export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

export function mutate<T>(
  client: QueryClient,
  key: readonly unknown[],
  variables: T,
) {
  return client
    .getMutationCache()
    .build(client, { mutationKey: key })
    .execute(variables)
    .catch(() => undefined);
}

export const toast = () => useToastStore.getState().current?.message;
