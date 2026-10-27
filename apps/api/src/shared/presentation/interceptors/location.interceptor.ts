import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { DEFAULT_VERSION, GLOBAL_PREFIX } from '../routing';

interface ResponseLike {
  setHeader(name: string, value: string): unknown;
}

const segments = (path: unknown): string[] =>
  [path]
    .flat()
    .filter((part): part is string => typeof part === 'string')
    .flatMap((part) => part.split('/'))
    .filter((part) => part !== '');

@Injectable()
export class LocationInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector = new Reflector()) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const base = this.collectionPath(context);
    return next.handle().pipe(
      tap((value: unknown) => {
        const id = (value as { id?: unknown } | null)?.id;
        if (typeof id === 'string') {
          http
            .getResponse<ResponseLike>()
            .setHeader('Location', `${base}/${id}`);
        }
      }),
    );
  }

  private collectionPath(context: ExecutionContext): string {
    const targets = [context.getHandler(), context.getClass()];
    const declared = [
      this.reflector.getAllAndOverride<unknown>(VERSION_METADATA, targets) ??
        DEFAULT_VERSION,
    ].flat()[0];
    return `/${[
      ...segments(GLOBAL_PREFIX),
      ...(typeof declared === 'string' ? [`v${declared}`] : []),
      ...segments(
        this.reflector.get<unknown>(PATH_METADATA, context.getClass()),
      ),
      ...segments(
        this.reflector.get<unknown>(PATH_METADATA, context.getHandler()),
      ),
    ].join('/')}`;
  }
}
