import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SpanStatusCode } from '@opentelemetry/api';
import {
  DomainError,
  InvalidField,
} from '../../../../../src/shared/domain/domain-error';
import {
  ApiException,
  RequestValidationException,
} from '../../../../../src/shared/presentation/filters/api-exception';
import { ErrorCode } from '../../../../../src/shared/presentation/filters/error-codes';
import {
  DOMAIN_ERROR_STATUS,
  ErrorEnvelope,
  GlobalExceptionFilter,
} from '../../../../../src/shared/presentation/filters/global-exception.filter';

class SampleNotFound extends DomainError {
  readonly code = 'SAMPLE_NOT_FOUND';
  readonly kind = 'not_found';

  constructor() {
    super('The sample does not exist.');
  }
}

class SampleConflict extends DomainError {
  readonly code = 'SAMPLE_CHANGED';
  readonly kind = 'conflict';

  constructor(currentVersion: number) {
    super('The sample was changed by someone else.', { currentVersion });
  }
}

class SampleRule extends DomainError {
  readonly code = 'SAMPLE_RULE';
  readonly kind = 'rule';

  constructor() {
    super('The sample breaks a rule.');
  }
}

class InvalidSample extends InvalidField {
  constructor() {
    super('sample', 'sample must be a sample');
  }
}

const REQUEST_ID = 'req-1.2_3';

function run(
  exception: unknown,
  opts: { url?: string; spanTraceId?: string; requestId?: unknown } = {},
) {
  const sent: { status?: number; body?: ErrorEnvelope } = {};
  const response = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    json(body: ErrorEnvelope) {
      sent.body = body;
      return this;
    },
  };
  const request = {
    id: opts.requestId === undefined ? REQUEST_ID : opts.requestId,
    method: 'GET',
    originalUrl: opts.url ?? '/api/v1/things?token=secret-value',
    headers: { 'x-request-id': '<script>' },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  const logger = { error: jest.fn() };
  const span = {
    spanContext: () => ({
      traceId: opts.spanTraceId ?? '0'.repeat(32),
      spanId: '1'.repeat(16),
      traceFlags: 1,
    }),
    setStatus: jest.fn(),
    setAttribute: jest.fn(),
    recordException: jest.fn(),
  };
  const filter = new GlobalExceptionFilter({
    logger,
    activeSpan: () => span,
  });
  filter.catch(exception, host);
  return { sent, logger, span };
}

describe('GlobalExceptionFilter', () => {
  it('AC-01.6.6 request validation → 400 VALIDATION_FAILED with details', () => {
    const { sent } = run(
      new RequestValidationException([
        { field: 'updatedAt', message: 'property updatedAt should not exist' },
      ]),
    );

    expect(sent.status).toBe(400);
    expect(sent.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
        details: [
          {
            field: 'updatedAt',
            message: 'property updatedAt should not exist',
          },
        ],
        traceId: REQUEST_ID,
      },
    });
  });

  it.each([
    [
      new UnauthorizedException('raw detail'),
      401,
      'UNAUTHENTICATED',
      'Authentication required.',
    ],
    [new ForbiddenException('raw detail'), 403, 'FORBIDDEN', 'Forbidden.'],
    [
      new NotFoundException('Cannot GET /api/v1/x?token=secret-value'),
      404,
      'ROUTE_NOT_FOUND',
      'Route not found.',
    ],
    [
      new BadRequestException('Unexpected token } in JSON'),
      400,
      'VALIDATION_FAILED',
      'Request validation failed.',
    ],
    [
      new HttpException('raw detail', HttpStatus.METHOD_NOT_ALLOWED),
      405,
      'METHOD_NOT_ALLOWED',
      'Method not allowed.',
    ],
    [
      new HttpException('raw detail', HttpStatus.UNSUPPORTED_MEDIA_TYPE),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Unsupported media type.',
    ],
    [
      new HttpException('raw detail', HttpStatus.TOO_MANY_REQUESTS),
      429,
      'RATE_LIMITED',
      'Too many requests.',
    ],
  ])(
    'framework %p → %i %s with a fixed message that never echoes the exception',
    (exception, status, code, message) => {
      const { sent, logger } = run(exception);

      expect(sent.status).toBe(status);
      expect(sent.body?.error).toEqual({ code, message, traceId: REQUEST_ID });
      expect(JSON.stringify(sent.body)).not.toContain('raw detail');
      expect(JSON.stringify(sent.body)).not.toContain('secret-value');
      expect(logger.error).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      {
        status: 413,
        type: 'entity.too.large',
        message: 'request entity too large',
      },
      413,
      'PAYLOAD_TOO_LARGE',
      'Payload too large.',
    ],
    [
      {
        status: 400,
        type: 'entity.parse.failed',
        message: 'Unexpected token x',
      },
      400,
      'VALIDATION_FAILED',
      'Request validation failed.',
    ],
    [
      {
        statusCode: 415,
        type: 'charset.unsupported',
        message: 'unsupported charset',
      },
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Unsupported media type.',
    ],
  ])('body-parser error %p → %i %s', (exception, status, code, message) => {
    const { sent } = run(
      Object.assign(new Error(exception.message), exception),
    );

    expect(sent.status).toBe(status);
    expect(sent.body?.error).toEqual({ code, message, traceId: REQUEST_ID });
  });

  it('our own ApiException keeps its code, message and details', () => {
    const { sent } = run(
      new ApiException(429, ErrorCode.RATE_LIMITED, 'Slow down, please.'),
    );

    expect(sent.status).toBe(429);
    expect(sent.body?.error).toEqual({
      code: 'RATE_LIMITED',
      message: 'Slow down, please.',
      traceId: REQUEST_ID,
    });
  });

  it('AC-09.6 maps each domain error kind to its status in one place', () => {
    expect(DOMAIN_ERROR_STATUS).toEqual({
      validation: 400,
      not_found: 404,
      conflict: 409,
      rule: 422,
    });
  });

  it.each([
    [new InvalidSample(), 400],
    [new SampleNotFound(), 404],
    [new SampleConflict(4), 409],
    [new SampleRule(), 422],
  ])('AC-09.6 a domain error %p answers %i', (error, status) => {
    expect(run(error).sent.status).toBe(status);
  });

  it('AC-09.6 a domain error answers with its code, message and details', () => {
    expect(run(new SampleNotFound()).sent).toEqual({
      status: 404,
      body: {
        error: {
          code: 'SAMPLE_NOT_FOUND',
          message: 'The sample does not exist.',
          traceId: REQUEST_ID,
        },
      },
    });
    expect(run(new SampleConflict(4)).sent.body?.error).toEqual({
      code: 'SAMPLE_CHANGED',
      message: 'The sample was changed by someone else.',
      details: { currentVersion: 4 },
      traceId: REQUEST_ID,
    });
  });

  it('AC-09.6 a validation error keeps the VALIDATION_FAILED envelope naming its field', () => {
    expect(run(new InvalidSample()).sent.body?.error).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed.',
      details: [{ field: 'sample', message: 'sample must be a sample' }],
      traceId: REQUEST_ID,
    });
  });

  it('a domain error is never logged as unexpected', () => {
    const { logger, span } = run(new SampleRule());

    expect(logger.error).not.toHaveBeenCalled();
    expect(span.setStatus).not.toHaveBeenCalled();
  });

  describe('unexpected errors', () => {
    it('AC-06.3.4 → 500 INTERNAL_ERROR with a generic message', () => {
      for (const exception of [new Error('boom'), 'a string']) {
        const { sent } = run(exception);

        expect(sent.status).toBe(500);
        expect(sent.body).toEqual({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred.',
            traceId: REQUEST_ID,
          },
        });
      }
    });

    it('a 5xx HttpException is unexpected too: generic body, logged', () => {
      const { sent, logger } = run(new HttpException('db down', 503));

      expect(sent.status).toBe(500);
      expect(sent.body?.error.code).toBe('INTERNAL_ERROR');
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('Lynx: a Prisma unique violation never puts its DETAIL in the log entry or the span', () => {
      const detail =
        'Key (email)=(marina@example.test) already exists. DETAIL: secret-value';
      const prismaError = Object.assign(
        new Error(
          `Unique constraint failed on the fields: (\`email\`)\n${detail}`,
        ),
        {
          name: 'PrismaClientKnownRequestError',
          code: 'P2002',
          meta: {
            target: ['email'],
            driverAdapterError: { cause: { message: detail } },
          },
        },
      );

      const { sent, logger, span } = run(prismaError, {
        spanTraceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      });

      expect(sent.body?.error.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith({
        msg: 'request.failed',
        err: { name: 'PrismaClientKnownRequestError', code: 'P2002' },
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        method: 'GET',
        path: '/api/v1/things',
      });
      expect(span.recordException).not.toHaveBeenCalled();
      expect(span.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'PrismaClientKnownRequestError',
      });
      expect(span.setAttribute).toHaveBeenCalledWith(
        'error.type',
        'PrismaClientKnownRequestError',
      );
      const everything = JSON.stringify([
        sent.body,
        logger.error.mock.calls,
        span.setStatus.mock.calls,
        span.setAttribute.mock.calls,
      ]);
      for (const leak of [
        'marina',
        'secret-value',
        'DETAIL',
        'Unique constraint',
        'token=',
      ]) {
        expect(everything).not.toContain(leak);
      }
    });

    it('an error without a string code is logged with its name only', () => {
      const { logger } = run(Object.assign(new TypeError('x'), { code: 42 }));

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: { name: 'TypeError' } }),
      );
    });
  });

  describe('traceId', () => {
    it('never uses the raw X-Request-Id header: without a resolved id it generates one', () => {
      const traceId = run(new NotFoundException(), { requestId: null }).sent
        .body?.error.traceId;

      expect(traceId).toMatch(/^[0-9a-f-]{36}$/);
      expect(traceId).not.toContain('script');
    });

    it('AC-06.2.4 is the active span trace id when it is valid, otherwise the request id', () => {
      expect(run(new NotFoundException()).sent.body?.error.traceId).toBe(
        REQUEST_ID,
      );
      expect(
        run(new NotFoundException(), {
          spanTraceId: 'abcdef0123456789abcdef0123456789',
        }).sent.body?.error.traceId,
      ).toBe('abcdef0123456789abcdef0123456789');
    });
  });
});
