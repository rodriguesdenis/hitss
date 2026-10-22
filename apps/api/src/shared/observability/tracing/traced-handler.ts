import { type Span, SpanStatusCode, trace } from '@opentelemetry/api';

const TRACER_NAME = 'teams-tasks-api';

/** Marks the span failed with the error class only: messages and stacks may carry user data. */
function fail(span: Span, error: unknown): void {
  span.setAttribute(
    'error.type',
    error instanceof Error ? error.constructor.name : 'unknown',
  );
  span.setStatus({ code: SpanStatusCode.ERROR });
  span.end();
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as PromiseLike<unknown> | undefined)?.then === 'function';

/**
 * Wraps a command/query handler method (`execute` / `handle`) in a span named after the handler
 * class: the "use-case" span between the HTTP span and the database spans (AC-06.2.1). Arguments
 * and results are never recorded (AC-06.2.5). With telemetry off the API returns a no-op span.
 */
export function Traced(): MethodDecorator {
  return (target, _propertyKey, descriptor) => {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    const handler = target.constructor.name;

    descriptor.value = function (this: unknown, ...args: unknown[]) {
      return trace
        .getTracer(TRACER_NAME)
        .startActiveSpan(
          handler,
          { attributes: { 'app.handler': handler } },
          (span) => {
            try {
              const result = original.apply(this, args);
              if (!isPromiseLike(result)) {
                span.end();
                return result;
              }
              return Promise.resolve(result).then(
                (value) => {
                  span.end();
                  return value;
                },
                (error: unknown) => {
                  fail(span, error);
                  throw error;
                },
              );
            } catch (error) {
              fail(span, error);
              throw error;
            }
          },
        );
    } as typeof descriptor.value;
  };
}
