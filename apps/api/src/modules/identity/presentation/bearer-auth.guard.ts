import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { PUBLIC_ROUTE } from '../../../shared/presentation/decorators/public.decorator';

const BEARER = /^bearer \S/i;

interface GuardedRequest {
  headers: Record<string, string | string[] | undefined>;
  session?: unknown;
  user?: unknown;
}

/**
 * Bearer-only authentication for the API routes (ADR-0020, AC-08.2): only the `Authorization:
 * Bearer` header is handed to Better Auth, so a session cookie alone never authenticates
 * `/api/v1` and no CSRF defence is needed there. Better Auth's bearer plugin verifies the signed
 * token (an unsigned, forged, revoked or expired one yields no session). Sets `request.session`
 * and `request.user` (null when anonymous) for `@CurrentOwner()` and the per-user throttler.
 * `@Public()` routes pass without credentials. `/api/auth/*` is Better Auth middleware, not a
 * Nest route, so it keeps its own cookie handling.
 */
@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const header = request.headers.authorization;
    const authorization = Array.isArray(header) ? header[0] : header;
    const session =
      authorization && BEARER.test(authorization)
        ? await this.auth.api.getSession({
            headers: new Headers({ authorization }),
          })
        : null;
    request.session = session;
    request.user = session?.user ?? null;

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );
    if (!session && !isPublic) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
