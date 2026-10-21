import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { traceFields } from './trace-fields';

describe('traceFields', () => {
  it('AC-06.5.3 is empty without an active span (telemetry off)', () => {
    expect(traceFields()).toEqual({});
  });

  it('AC-06.3.2 returns the active span trace id and span id', () => {
    const manager = new AsyncLocalStorageContextManager().enable();
    context.setGlobalContextManager(manager);
    const tracer = new TracerProvider().getTracer('test');

    tracer.startActiveSpan('work', (span) => {
      expect(traceFields()).toEqual({
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
      });
      span.end();
    });

    context.disable();
    trace.disable();
  });
});
