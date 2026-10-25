import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { createQueryClient } from '@/lib/query-client';
import { ThemeProvider } from '@/theme/ThemeProvider';

export function createTestQueryClient(
  options: Parameters<typeof createQueryClient>[0] = {},
): QueryClient {
  const client = createQueryClient(options);
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    queries: {
      ...client.getDefaultOptions().queries,
      retry: false,
      gcTime: Infinity,
    },
  });
  return client;
}

export async function renderWithProviders(
  ui: ReactElement,
  { queryClient = createTestQueryClient() }: { queryClient?: QueryClient } = {},
) {
  const result = await render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}
