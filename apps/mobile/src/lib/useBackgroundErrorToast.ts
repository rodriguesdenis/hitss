import { useEffect, useRef } from 'react';

import { showToast } from '@/ui';

import { errorMessage } from './error-messages';

export interface BackgroundErrorSource {
  error: unknown;
  errorUpdatedAt: number;
  isError: boolean;
  isFetchNextPageError?: boolean;
  refetch: () => Promise<unknown>;
}

export function useBackgroundErrorToast(
  query: BackgroundErrorSource,
  hasData: boolean,
) {
  const manual = useRef(false);
  const shown = useRef(0);
  const { error, errorUpdatedAt, isError, isFetchNextPageError, refetch } =
    query;

  useEffect(() => {
    if (
      !isError ||
      !hasData ||
      isFetchNextPageError ||
      manual.current ||
      shown.current === errorUpdatedAt
    ) {
      return;
    }
    shown.current = errorUpdatedAt;
    showToast({
      message: errorMessage(error),
      tone: 'error',
      action: { label: 'Tentar novamente', onPress: () => void refetch() },
    });
  }, [error, errorUpdatedAt, hasData, isError, isFetchNextPageError, refetch]);

  return async function refreshManually<T extends { errorUpdatedAt: number }>(
    run: () => Promise<T>,
  ): Promise<T> {
    manual.current = true;
    try {
      const result = await run();
      shown.current = result.errorUpdatedAt;
      return result;
    } finally {
      manual.current = false;
    }
  };
}
