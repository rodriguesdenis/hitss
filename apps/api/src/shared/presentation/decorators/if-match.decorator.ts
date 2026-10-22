import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ExpectedVersion } from '../../domain/expected-version';

const TAG = /^(?:W\/)?"([1-9]\d*)"$/;

/**
 * `If-Match` → ExpectedVersion (ADR-0015): absent or `*` → any; `W/"<n>"` or `"<n>"` with n ≥ 1 →
 * exact(n); anything else (a list, a bare number, garbage) → unmatchable, which handlers turn into
 * 412 after the 404 check.
 */
export function parseIfMatch(
  header: string | string[] | undefined,
): ExpectedVersion {
  if (Array.isArray(header)) {
    return ExpectedVersion.unmatchable();
  }
  const value = header?.trim();
  if (value === undefined || value === '*') {
    return ExpectedVersion.any();
  }
  const match = TAG.exec(value);
  return match?.[1]
    ? ExpectedVersion.exact(Number(match[1]))
    : ExpectedVersion.unmatchable();
}

/** The request's `If-Match` precondition as an ExpectedVersion. */
export const IfMatch = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ExpectedVersion =>
    parseIfMatch(
      context.switchToHttp().getRequest<{
        headers: Record<string, string | string[] | undefined>;
      }>().headers['if-match'],
    ),
);
