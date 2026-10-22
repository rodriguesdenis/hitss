import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiException } from '../filters/api-exception';
import { ErrorCode } from '../filters/error-codes';

const WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

interface IncomingRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

const header = (request: IncomingRequest, name: string): string | undefined => {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

/**
 * The API accepts JSON bodies only (api-contracts → 415): a POST, PUT or PATCH whose body is not
 * `application/json` gets 415 UNSUPPORTED_MEDIA_TYPE, for every client, bearer or cookie
 * (AC-01.5.9; Trestle review of #52). Registered as a global guard after authentication, so an
 * anonymous request still gets 401 first. It also closes the forms and `text/plain` bodies a
 * cross-site page can send without a CORS preflight.
 */
@Injectable()
export class JsonBodyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<IncomingRequest>();
    if (!WITH_BODY.has(request.method.toUpperCase()) || !hasBody(request)) {
      return true;
    }
    const type = header(request, 'content-type')
      ?.split(';')[0]
      ?.trim()
      .toLowerCase();
    if (type !== 'application/json') {
      throw new ApiException(
        415,
        ErrorCode.UNSUPPORTED_MEDIA_TYPE,
        'Unsupported media type.',
      );
    }
    return true;
  }
}

function hasBody(request: IncomingRequest): boolean {
  const length = header(request, 'content-length');
  return (
    (length !== undefined && length !== '0') ||
    header(request, 'transfer-encoding') !== undefined
  );
}
