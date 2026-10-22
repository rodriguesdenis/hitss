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
const BUSINESS_API = '/api/v1/';

interface IncomingRequest {
  method: string;
  originalUrl?: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  /** Set by the auth guard: null for an anonymous request (public routes). */
  session?: unknown;
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
 * CSRF protection for cookie sessions (S-M2), after the auth guard. It applies only to
 * authenticated, unsafe requests on /api/v1 sent without a bearer token (anonymous requests to
 * public routes carry no credential to abuse): a cookie is an ambient credential, a bearer
 * token is not (AC-01.5.10), and a browser cannot add `Authorization` cross-origin without a
 * CORS preflight the allowlist refuses.
 * - `Origin` (else `Referer`) present and not trusted, or `Sec-Fetch-Site: cross-site`
 *   → 403 CSRF_REJECTED (AC-01.5.8). Native clients send no Origin and pass.
 * - A body that is not `application/json` → 415 UNSUPPORTED_MEDIA_TYPE (AC-01.5.9): forms and
 *   `text/plain`, the content types a cross-site page can send without a preflight.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly trusted: string[];

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.trusted = trustedOrigins(config);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<IncomingRequest>();
    const path = request.originalUrl ?? request.url;
    if (
      !request.session ||
      !UNSAFE_METHODS.has(request.method.toUpperCase()) ||
      !path.startsWith(BUSINESS_API) ||
      /^bearer /i.test(header(request, 'authorization') ?? '')
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
    if (
      this.hasBody(request) &&
      !this.isJson(header(request, 'content-type'))
    ) {
      throw new ApiException(
        415,
        ErrorCode.UNSUPPORTED_MEDIA_TYPE,
        'Unsupported media type.',
      );
    }
    return true;
  }

  /** Exact web origins; scheme entries (`teamstasks://`, `exp://`) match by prefix, as Better Auth does. */
  private isTrusted(origin: string): boolean {
    return this.trusted.some((trusted) =>
      trusted.endsWith('://') ? origin.startsWith(trusted) : origin === trusted,
    );
  }

  private hasBody(request: IncomingRequest): boolean {
    const length = header(request, 'content-length');
    return (
      (length !== undefined && length !== '0') ||
      header(request, 'transfer-encoding') !== undefined
    );
  }

  private isJson(contentType: string | undefined): boolean {
    return (
      contentType?.split(';')[0]?.trim().toLowerCase() === 'application/json'
    );
  }
}
