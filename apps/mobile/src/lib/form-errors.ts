import { ApiError } from '@hitss/api-client';

export function errorDetails(error: unknown): unknown {
  if (!(error instanceof ApiError)) {
    return undefined;
  }
  return (error.body as { error?: { details?: unknown } } | undefined)?.error
    ?.details;
}

export function validationFields(error: unknown): string[] {
  const details = errorDetails(error);
  return Array.isArray(details)
    ? details.map((detail: { field?: unknown }) => String(detail.field))
    : [];
}

export function errorCountMessage(count: number): string {
  return count === 1
    ? 'Corrija 1 erro para continuar'
    : `Corrija ${count} erros para continuar`;
}
