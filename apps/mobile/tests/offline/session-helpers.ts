import type { TaskStatusVars } from '@/features/tasks';
import { mk } from '@/lib/query-keys';
import { startNetwork } from '@/offline/network';

import { queryClient } from '../app-harness';
import { setNetwork } from '../mocks/netinfo';
import { server } from '../server';

export const crash = { id: 'task-crash', title: 'Fix crash on Android' };

export function trackWrites() {
  const writes: string[] = [];
  server.events.on('request:start', ({ request }) => {
    if (
      request.method !== 'GET' &&
      new URL(request.url).pathname.startsWith('/api/v1')
    ) {
      writes.push(`${request.method} ${new URL(request.url).pathname}`);
    }
  });
  return writes;
}

export function queueStatusChange() {
  void queryClient()
    .getMutationCache()
    .build(queryClient(), { mutationKey: mk.tasks.changeStatus })
    .execute({ ...crash, status: 'DONE' } satisfies TaskStatusVars)
    .catch(() => undefined);
}

export function withNetwork() {
  const stop = startNetwork();
  return () => {
    stop();
    setNetwork({ isConnected: true });
  };
}
