import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

import { subscribeAppFocus } from './query-client';

export function QueryProvider({
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}) {
  useEffect(subscribeAppFocus, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
