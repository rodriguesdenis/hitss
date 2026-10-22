import { isSpanContextValid, trace } from '@opentelemetry/api';

export function traceFields(): { traceId?: string; spanId?: string } {
  const context = trace.getActiveSpan()?.spanContext();
  return context && isSpanContextValid(context)
    ? { traceId: context.traceId, spanId: context.spanId }
    : {};
}
