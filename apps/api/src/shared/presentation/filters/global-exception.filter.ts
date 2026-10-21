import { randomUUID } from 'node:crypto';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  isSpanContextValid,
  Span,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { DomainError } from '../../domain/domain-error';
import { sanitizeUrl } from '../../observability/sanitize-url';
import { ApiException } from './api-exception';
import { CodeAndMessage, describeClientError, UNEXPECTED } from './error-codes';

/** How a module's domain error becomes an HTTP error (registered by the module, e.g. teams). */
export interface DomainErrorMapping {
  error: abstract new (...args: never[]) => DomainError;
  status: number;
  code: string;
  details?: (error: DomainError) => unknown;
}

export interface ErrorEnvelope {
  error: CodeAndMessage & { details?: unknown; traceId: string };
}

interface ErrorLogger {
  error(entry: Record<string, unknown>): void;
}

type ActiveSpan = () =>
  Pick<Span, 'spanContext' | 'setStatus' | 'setAttribute'> | undefined;

interface HttpRequestLike {
  /** Set by requestIdMiddleware (shared/observability/logging/request-id.ts). */
  id?: unknown;
  method?: string;
  originalUrl?: string;
  url?: string;
}

interface HttpResponseLike {
  status(code: number): { json(body: ErrorEnvelope): unknown };
}

interface Described {
  status: number;
  error: CodeAndMessage & { details?: unknown };
}

/**
 * Turns every error into the contract's `{ error: { code, message, details?, traceId } }`.
 * Unexpected errors (5xx) become a generic 500 and produce exactly one error-level log entry,
 * whose `err` is `{ name, code }` only: driver and Prisma messages can carry row values
 * (DETAIL) or URLs, so they never reach the response, the log or the span.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly mappings: readonly DomainErrorMapping[];
  private readonly logger: ErrorLogger;
  private readonly activeSpan: ActiveSpan;

  constructor(
    options: {
      mappings?: readonly DomainErrorMapping[];
      logger?: ErrorLogger;
      activeSpan?: ActiveSpan;
    } = {},
  ) {
    this.mappings = options.mappings ?? [];
    this.logger = options.logger ?? new Logger(GlobalExceptionFilter.name);
    this.activeSpan = options.activeSpan ?? (() => trace.getActiveSpan());
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<HttpRequestLike>();
    const traceId = this.traceIdOf(request);
    const { status, error } = this.describe(exception);
    if (status >= 500) {
      this.reportUnexpected(exception, request, traceId);
    }
    http
      .getResponse<HttpResponseLike>()
      .status(status)
      .json({ error: { ...error, traceId } });
  }

  private describe(exception: unknown): Described {
    if (exception instanceof ApiException) {
      return {
        status: exception.getStatus(),
        error: withDetails(
          { code: exception.code, message: exception.message },
          exception.details,
        ),
      };
    }
    const mapping = this.mappings.find((m) => exception instanceof m.error);
    if (mapping && exception instanceof DomainError) {
      return {
        status: mapping.status,
        error: withDetails(
          { code: mapping.code, message: exception.message },
          mapping.details?.(exception),
        ),
      };
    }
    const status = clientErrorStatus(exception);
    return status === undefined
      ? { status: 500, error: UNEXPECTED }
      : { status, error: describeClientError(status) };
  }

  private reportUnexpected(
    exception: unknown,
    request: HttpRequestLike,
    traceId: string,
  ): void {
    const name = exception instanceof Error ? exception.name : typeof exception;
    const code = isRecord(exception) ? exception.code : undefined;
    this.logger.error({
      msg: 'request.failed',
      err: typeof code === 'string' ? { name, code } : { name },
      traceId,
      method: request.method,
      path: sanitizeUrl(request.originalUrl ?? request.url ?? ''),
    });
    const span = this.activeSpan();
    span?.setStatus({ code: SpanStatusCode.ERROR, message: name });
    span?.setAttribute('error.type', name);
  }

  /**
   * The trace id when telemetry runs, otherwise the request id resolved by the middleware
   * (never the raw X-Request-Id header, which may be unsafe).
   */
  private traceIdOf(request: HttpRequestLike): string {
    const context = this.activeSpan()?.spanContext();
    if (context && isSpanContextValid(context)) {
      return context.traceId;
    }
    return typeof request.id === 'string' ? request.id : randomUUID();
  }
}

function withDetails(
  error: CodeAndMessage,
  details: unknown,
): CodeAndMessage & { details?: unknown } {
  return details === undefined ? error : { ...error, details };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 4xx of an HttpException or of a body-parser (http-errors) error; anything else is unexpected. */
function clientErrorStatus(exception: unknown): number | undefined {
  const status =
    exception instanceof HttpException
      ? exception.getStatus()
      : isRecord(exception)
        ? (exception.status ?? exception.statusCode)
        : undefined;
  return typeof status === 'number' && status >= 400 && status < 500
    ? status
    : undefined;
}
