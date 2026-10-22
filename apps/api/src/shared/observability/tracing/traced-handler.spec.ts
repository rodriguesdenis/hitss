import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import { Traced } from './traced-handler';

class ListTasksHandler {
  readonly dependency = 'kept';

  @Traced()
  execute(query: { secret: string }): Promise<string> {
    return Promise.resolve(`${this.dependency}:${query.secret.length}`);
  }

  @Traced()
  executeSync(): number {
    return 7;
  }

  @Traced()
  fail(): Promise<never> {
    return Promise.reject(
      new TypeError('contains someone@example.test and secret-value'),
    );
  }

  @Traced()
  failSync(): never {
    throw new RangeError('boom secret-value');
  }
}

describe('@Traced', () => {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({
    spanProcessors: [new SimpleSpanProcessor({ exporter })],
  });
  const handler = new ListTasksHandler();

  beforeAll(() => {
    context.setGlobalContextManager(
      new AsyncLocalStorageContextManager().enable(),
    );
    trace.setGlobalTracerProvider(provider);
  });
  afterAll(async () => {
    context.disable();
    trace.disable();
    await provider.shutdown();
  });
  beforeEach(() => exporter.reset());

  it('AC-06.2.1 records a use-case span named after the handler class', async () => {
    await handler.execute({ secret: 'x' });

    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe('ListTasksHandler');
    expect(span?.attributes).toEqual({ 'app.handler': 'ListTasksHandler' });
  });

  it('AC-06.2.1 nests under the active HTTP span and parents spans started inside', async () => {
    const tracer = trace.getTracer('test');
    await tracer.startActiveSpan('GET /tasks', async (http) => {
      await handler.execute({ secret: 'x' });
      http.end();
    });

    const spans = exporter.getFinishedSpans();
    const http = spans.find((s) => s.name === 'GET /tasks');
    const useCase = spans.find((s) => s.name === 'ListTasksHandler');
    expect(useCase?.parentSpanContext?.spanId).toBe(http?.spanContext().spanId);
    expect(useCase?.spanContext().traceId).toBe(http?.spanContext().traceId);
  });

  it('AC-06.2.1 keeps the result, the arguments and this', async () => {
    await expect(handler.execute({ secret: 'abc' })).resolves.toBe('kept:3');
    expect(handler.executeSync()).toBe(7);
    expect(exporter.getFinishedSpans()).toHaveLength(2);
  });

  it('AC-06.2.5 never records arguments as attributes', async () => {
    await handler.execute({ secret: 'secret-value' });
    expect(
      JSON.stringify(exporter.getFinishedSpans()[0]?.attributes),
    ).not.toContain('secret-value');
  });

  it.each([
    ['async', () => handler.fail()],
    ['sync', () => handler.failSync()],
  ])(
    'AC-06.2.4 a %s failure is rethrown and marked on the span without message, stack or events',
    async (_kind, run) => {
      await expect(Promise.resolve().then(run)).rejects.toThrow();

      const [span] = exporter.getFinishedSpans();
      expect(span?.status.code).toBe(2); // SpanStatusCode.ERROR
      expect(span?.status.message).toBeUndefined();
      expect(span?.events).toHaveLength(0);
      expect(span?.attributes['error.type']).toMatch(/Error$/);
      const exported = JSON.stringify(span?.attributes);
      expect(exported).not.toContain('secret-value');
      expect(exported).not.toContain('someone@example.test');
    },
  );
});
