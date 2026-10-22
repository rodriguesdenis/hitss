const SIGN_UP = '/sign-up/email';
const SIGN_IN = '/sign-in/email';
const CONTROL = /\p{Cc}/u;
const NAME_MAX = 100;

export type AuthInputResult =
  { ok: true; body: Record<string, unknown> } | { ok: false; field: 'name' };

/**
 * Input rules Better Auth does not enforce itself (BR-01.3, AC-01.1.5, AC-01.2.6), applied before
 * its own validation:
 * - sign-up and sign-in: the email is trimmed (Better Auth lower-cases it); the password is never
 *   touched, so surrounding spaces are part of it;
 * - sign-up: the name must be a string with no control characters (checked before trimming, so
 *   none hides at an edge), 1–100 code points after trimming, and is stored trimmed.
 * Returns `undefined` for routes and bodies it does not handle.
 */
export function normalizeAuthInput(
  path: string,
  body: unknown,
): AuthInputResult | undefined {
  if (
    (path !== SIGN_UP && path !== SIGN_IN) ||
    typeof body !== 'object' ||
    body === null
  ) {
    return undefined;
  }
  const next: Record<string, unknown> = {
    ...(body as Record<string, unknown>),
  };
  if (typeof next.email === 'string') {
    next.email = next.email.trim();
  }
  if (path === SIGN_UP) {
    const { name } = next;
    if (typeof name !== 'string' || CONTROL.test(name)) {
      return { ok: false, field: 'name' };
    }
    const trimmed = name.trim();
    const length = [...trimmed].length;
    if (length < 1 || length > NAME_MAX) {
      return { ok: false, field: 'name' };
    }
    next.name = trimmed;
  }
  return { ok: true, body: next };
}
