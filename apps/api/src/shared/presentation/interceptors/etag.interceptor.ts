import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { Observable, tap } from 'rxjs';

/**
 * On single-resource responses (`GET /:id`, `POST`, `PUT`), sets `ETag: W/"<version>"` from the
 * returned resource (plan 002 → Shared HTTP building blocks). Applied per route with
 * `@UseInterceptors(EtagInterceptor)`; it runs inside the global envelope, so it sees the bare
 * resource. Clients send the tag back in `If-Match` (`@IfMatch()`).
 */
@Injectable()
export class EtagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<ServerResponse>();
    return next.handle().pipe(
      tap((value: unknown) => {
        const version = (value as { version?: unknown } | null | undefined)
          ?.version;
        if (
          !Array.isArray(value) &&
          Number.isInteger(version) &&
          (version as number) >= 1
        ) {
          response.setHeader('ETag', `W/"${version as number}"`);
        }
      }),
    );
  }
}
