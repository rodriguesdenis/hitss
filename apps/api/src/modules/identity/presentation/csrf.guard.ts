import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../config/app-config';
import { ApiException } from '../../../shared/presentation/filters/api-exception';
import { ErrorCode } from '../../../shared/presentation/filters/error-codes';
import { trustedOrigins } from '../auth.factory';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface IncomingRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  /** Set by the auth guard: null for an anonymous request (public routes). */
  session?: { session?: { token?: unknown } } | null;
}

const header = (request: IncomingRequest, name: string): string | undefined => {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

/** `https://host[:port]` of a Referer, or undefined when it is not a URL. */
function originOf(referer: string): string | undefined {
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

/**
 * CSRF protection for cookie sessions (S-M2), after the auth guard. It applies to every
 * authenticated, unsafe request sent without a bearer token (anonymous requests to public
 * routes carry no credential to abuse): a cookie is an ambient credential, a bearer token is
 * not (AC-01.5.10; only when the bearer token is what authenticated), and a browser cannot add `Authorization` cross-origin without a CORS
 * preflight the allowlist refuses. `Origin` (else `Referer`) present and not trusted, or
 * `Sec-Fetch-Site: cross-site` → 403 CSRF_REJECTED (AC-01.5.8); native clients send no Origin.
 *
 * The path is never inspected: global guards run only on Nest routes (`/api/auth/*` is Better
 * Auth middleware with its own origin check), and Express matches routes case-insensitively, so
 * a prefix test would let `/API/V1/...` through (Trestle review of #52). Non-JSON bodies are
 * JsonBodyGuard's job, for every client.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly trusted: string[];

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.trusted = trustedOrigins(config);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<IncomingRequest>();
    if (
      !request.session ||
      !UNSAFE_METHODS.has(request.method.toUpperCase()) ||
      this.authenticatedByBearer(request)
    ) {
      return true;
    }
    const origin = header(request, 'origin');
    const referer = header(request, 'referer');
    const source =
      origin ??
      (referer === undefined ? undefined : (originOf(referer) ?? 'null'));
    if (
      header(request, 'sec-fetch-site') === 'cross-site' ||
      (source !== undefined && !this.isTrusted(source))
    ) {
      throw new ApiException(
        403,
        ErrorCode.CSRF_REJECTED,
        'Cross-site request rejected.',
      );
    }
    return true;
  }

  /**
   * True only when the session came from the bearer token itself. The bearer plugin ignores an
   * invalid or unsigned token and falls back to the cookie, so the header prefix alone proves
   * nothing (`Bearer garbage` + a victim's cookie, Lynx review of #52). A verified bearer
   * `<token>.<signature>` is what became the session, so its token equals the session's.
   */
  private authenticatedByBearer(request: IncomingRequest): boolean {
    const authorization = header(request, 'authorization') ?? '';
    if (!/^bearer /i.test(authorization)) {
      return false;
    }
    let value = authorization.slice(7).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      return false;
    }
    const token = value.split('.')[0];
    return token !== '' && token === request.session?.session?.token;
  }

  /** Exact web origins; scheme entries (`teamstasks://`, `exp://`) match by prefix, as Better Auth does. */
  private isTrusted(origin: string): boolean {
    return this.trusted.some((trusted) =>
      trusted.endsWith('://') ? origin.startsWith(trusted) : origin === trusted,
    );
  }
}
