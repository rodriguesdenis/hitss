import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

interface RequestLike {
  originalUrl?: string;
  url?: string;
}

interface ResponseLike {
  setHeader(name: string, value: string): unknown;
}

export function locationOf(request: RequestLike, id: string): string {
  const path = (request.originalUrl ?? request.url ?? '')
    .split('?')[0]!
    .replace(/\/+$/, '');
  return `${path}/${id}`;
}

@Injectable()
export class LocationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    return next.handle().pipe(
      tap((value: unknown) => {
        const id = (value as { id?: unknown } | null)?.id;
        if (typeof id === 'string') {
          http
            .getResponse<ResponseLike>()
            .setHeader(
              'Location',
              locationOf(http.getRequest<RequestLike>(), id),
            );
        }
      }),
    );
  }
}
