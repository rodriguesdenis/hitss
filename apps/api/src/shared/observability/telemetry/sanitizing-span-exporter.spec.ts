import type { ExportResult } from '@opentelemetry/core';
import type * as tracing from '@opentelemetry/sdk-trace';
type ReadableSpan = tracing.ReadableSpan;
type SpanExporter = tracing.SpanExporter;
import { SanitizingSpanExporter } from './sanitizing-span-exporter';

function run(attributes: Record<string, string>): Record<string, unknown> {
  let seen: ReadableSpan[] = [];
  const inner: SpanExporter = {
    export: (spans: ReadableSpan[], done: (r: ExportResult) => void) => {
      seen = spans;
      done({ code: 0 });
    },
    shutdown: () => Promise.resolve(),
  };
  const span = {
    name: 'GET',
    attributes,
    events: [],
    status: { code: 0 },
  } as unknown as ReadableSpan;
  new SanitizingSpanExporter(inner).export([span], () => undefined);
  return seen[0]?.attributes ?? {};
}

describe('SanitizingSpanExporter', () => {
  it('AC-06.2.5 strips query strings from every URL attribute and drops url.query', () => {
    expect(
      run({
        'url.full': '/ping?token=secret-value',
        'http.url': 'http://h/ping?search=marina#frag',
        'http.target': '/ping?x=1',
        'url.query': 'token=secret-value',
        'url.path': '/ping',
        'http.route': '/ping',
      }),
    ).toEqual({
      'url.full': '/ping',
      'http.url': 'http://h/ping',
      'http.target': '/ping',
      'url.path': '/ping',
      'http.route': '/ping',
    });
  });

  it('AC-06.2.5 leaves other attributes untouched and does not mutate the span', () => {
    const attributes = { 'url.full': '/a?b=1', other: 'x?y' };
    const span = {
      attributes,
      events: [],
      status: { code: 0 },
    } as unknown as ReadableSpan;
    const inner = { export: jest.fn(), shutdown: jest.fn() };
    new SanitizingSpanExporter(inner).export([span], () => undefined);
    expect(attributes['url.full']).toBe('/a?b=1');
    const sent = (inner.export.mock.calls[0] as [ReadableSpan[]])[0][0];
    expect(sent?.attributes.other).toBe('x?y');
  });

  it('AC-06.2.5 drops exception messages, stacks and the status message but keeps the error type', () => {
    let sent: ReadableSpan[] = [];
    const inner: SpanExporter = {
      export: (spans: ReadableSpan[]) => {
        sent = spans;
      },
      shutdown: () => Promise.resolve(),
    };
    const span = {
      attributes: {},
      status: { code: 2, message: 'failed for someone@example.test' },
      events: [
        {
          name: 'exception',
          time: [0, 0],
          attributes: {
            'exception.type': 'TypeError',
            'exception.message': 'secret-value',
            'exception.stacktrace': 'TypeError: secret-value\n    at x',
          },
        },
      ],
    } as unknown as ReadableSpan;

    new SanitizingSpanExporter(inner).export([span], () => undefined);

    expect(sent[0]?.status).toEqual({ code: 2 });
    expect(sent[0]?.events[0]?.attributes).toEqual({
      'exception.type': 'TypeError',
    });
    expect(JSON.stringify(sent[0]?.events)).not.toContain('secret-value');
    // The original span is untouched for other processors.
    expect(span.status.message).toBeDefined();
  });

  it.each([
    'exception.message',
    'exception.stacktrace',
    'error.message',
    'db.error.message',
    'prisma.error_message',
    'http.error_message',
  ])('AC-06.2.5 drops the error text attribute %s', (key) => {
    expect(
      run({ [key]: 'DETAIL: Key (email)=(someone@example.test)' }),
    ).toEqual({});
  });

  it.each(['error.type', 'exception.type', 'error.name', 'db.error.code'])(
    'AC-06.2.5 keeps the identifying attribute %s',
    (key) => {
      expect(run({ [key]: 'TypeError' })).toEqual({ [key]: 'TypeError' });
    },
  );
});
