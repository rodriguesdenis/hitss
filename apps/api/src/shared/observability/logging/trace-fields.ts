import { isSpanContextValid, trace } from '@opentelemetry/api';

/** `{ traceId, spanId }` of the active span, or nothing when telemetry is off (AC-06.3.1). */
export function traceFields(): { traceId?: string; spanId?: string } {
  const context = trace.getActiveSpan()?.spanContext();
  return context && isSpanContextValid(context)
    ? { traceId: context.traceId, spanId: context.spanId }
    : {};
}
