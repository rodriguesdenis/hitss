import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { RAW_RESPONSE } from '../decorators/raw-response.decorator';

const ENVELOPE_KEYS: ReadonlySet<string> = new Set(['data', 'meta']);

/** `{ data }` or `{ data, meta }` built by a handler (pages): passed through, not wrapped twice. */
function isEnvelope(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.includes('data') && keys.every((key) => ENVELOPE_KEYS.has(key));
}

/**
 * Wraps what a handler returns as `{ data }` (ADR-0005). An empty result stays empty (204), and
 * `@RawResponse()` handlers, streamed files and non-HTTP contexts are left untouched.
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean | undefined>(
      RAW_RESPONSE,
      [context.getHandler(), context.getClass()],
    );
    if (context.getType() !== 'http' || raw === true) {
      return next.handle();
    }
    return next
      .handle()
      .pipe(
        map((value: unknown) =>
          value === undefined ||
          value instanceof StreamableFile ||
          isEnvelope(value)
            ? value
            : { data: value },
        ),
      );
  }
}
