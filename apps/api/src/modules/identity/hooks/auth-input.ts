const SIGN_UP = '/sign-up/email';
const SIGN_IN = '/sign-in/email';
const CONTROL = /\p{Cc}/u;
const NAME_MAX = 100;

export type AuthInputResult =
  { ok: true; body: Record<string, unknown> } | { ok: false; field: 'name' };

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
