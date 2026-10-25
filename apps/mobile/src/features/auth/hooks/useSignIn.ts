import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { errorMessage, errorMessages } from '@/lib/error-messages';

import { authClient, refreshSession } from '../auth-client';
import { signInSchema, type SignInValues } from '../sign-in.schema';
import { useSessionStore } from '../session.store';

const INVALID_CREDENTIALS = 'E-mail ou senha incorretos';

function clampSeconds(header: string | null): number {
  const seconds = Number(header);
  return Number.isFinite(seconds)
    ? Math.min(60, Math.max(1, Math.ceil(seconds)))
    : 60;
}

export function signInErrorMessage(
  status: number | undefined,
  retryAfter: string | null,
): string {
  if (status === 401) {
    return INVALID_CREDENTIALS;
  }
  if (status === 429) {
    return errorMessages.RATE_LIMITED.replace(
      '{seconds}',
      String(clampSeconds(retryAfter)),
    );
  }
  if (!status) {
    return errorMessages.NETWORK;
  }
  return errorMessages.INTERNAL_ERROR;
}

export function useSignIn() {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const submit = form.handleSubmit(async ({ email, password }) => {
    setFormError(null);
    let retryAfter: string | null = null;
    let error: { status?: number } | null;
    try {
      ({ error } = await authClient.signIn.email(
        { email, password },
        {
          onError: ({ response }) => {
            retryAfter = response.headers.get('X-Retry-After');
          },
        },
      ));
    } catch (thrown) {
      setFormError(errorMessage(thrown));
      return;
    }
    if (error) {
      setFormError(signInErrorMessage(error.status, retryAfter));
      return;
    }
    useSessionStore.getState().clearExpired();
    refreshSession();
  });

  return { form, submit, formError };
}
