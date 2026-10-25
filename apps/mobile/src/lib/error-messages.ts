import { ApiError, type ApiErrorResponseDto } from '@hitss/api-client';

export const errorMessages = {
  VALIDATION_FAILED:
    'Alguns campos são inválidos. Verifique os campos destacados.',
  UNAUTHENTICATED: 'Sua sessão expirou. Entre novamente.',
  TASK_NOT_FOUND: 'Esta tarefa não existe mais.',
  TEAM_NOT_FOUND: 'Este time não existe mais.',
  ROUTE_NOT_FOUND: 'Algo está desatualizado. Atualize o aplicativo.',
  TEAM_NAME_ALREADY_EXISTS: 'Você já tem um time com este nome.',
  UNKNOWN_TEAMS: 'Alguns times não existem mais e foram removidos.',
  TOO_MANY_TEAMS: 'Uma tarefa pode ter até 10 times.',
  RATE_LIMITED: 'Muitas requisições. Tente novamente em {seconds} s.',
  INTERNAL_ERROR: 'Algo deu errado do nosso lado. Tente novamente.',
  NETWORK: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
  TIMEOUT: 'O servidor está demorando demais. Tente novamente.',
} as const;

export type ErrorCode = keyof typeof errorMessages;

function isKnownCode(code: unknown): code is ErrorCode {
  return typeof code === 'string' && Object.hasOwn(errorMessages, code);
}

export function errorCode(error: unknown): ErrorCode {
  if (error instanceof ApiError) {
    const code = (error.body as Partial<ApiErrorResponseDto> | undefined)?.error
      ?.code;
    return isKnownCode(code) ? code : 'INTERNAL_ERROR';
  }
  if (error instanceof Error && error.name === 'TimeoutError') {
    return 'TIMEOUT';
  }
  if (error instanceof TypeError) {
    return 'NETWORK';
  }
  return 'INTERNAL_ERROR';
}

export function errorMessage(
  error: unknown,
  { retryAfterSeconds = 60 }: { retryAfterSeconds?: number } = {},
): string {
  return errorMessages[errorCode(error)].replace(
    '{seconds}',
    String(retryAfterSeconds),
  );
}
