import { errorMessage } from '@/lib/error-messages';
import { showToast } from '@/ui';

import type { Discard } from './durable-mutation';

export const QUEUED_MESSAGE =
  'Salvo. Será sincronizado quando você estiver online.';

export function discardMessage(
  reason: Discard,
  error: unknown,
  title: string,
  gone: string = `“${title}” foi excluída em outro lugar.`,
): string | null {
  if (reason === 'dependency-failed') {
    return null;
  }
  if (reason === 'gone') {
    return gone;
  }
  return `Não foi possível salvar “${title}”: ${errorMessage(error)}`;
}

export function warnDiscarded(message: string | null): void {
  if (message) {
    showToast({ message, tone: 'error' });
  }
}
