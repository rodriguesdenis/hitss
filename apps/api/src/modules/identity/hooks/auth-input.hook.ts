import { APIError, createAuthMiddleware } from 'better-auth/api';
import { normalizeAuthInput } from './auth-input';

/**
 * Better Auth `hooks.before`: runs before the endpoint validates its body, so the trimmed email
 * is what Better Auth checks and stores. An invalid name answers Better Auth's native 400.
 */
/** A replacement body for the endpoint, or nothing to change. */
type HookResult = { context: { body: Record<string, unknown> } } | undefined;

export const authInputHook = createAuthMiddleware(
  (ctx): Promise<HookResult> => {
    const result = normalizeAuthInput(ctx.path, ctx.body);
    if (!result) {
      return Promise.resolve(undefined);
    }
    if (!result.ok) {
      return Promise.reject(
        new APIError('BAD_REQUEST', {
          code: 'INVALID_NAME',
          message:
            'Name must be 1 to 100 characters with no control characters.',
        }),
      );
    }
    return Promise.resolve({ context: { body: result.body } });
  },
);
