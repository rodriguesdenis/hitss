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
  const span = { name: 'GET', attributes } as unknown as ReadableSpan;
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
    const span = { attributes } as unknown as ReadableSpan;
    const inner = { export: jest.fn(), shutdown: jest.fn() };
    new SanitizingSpanExporter(inner).export([span], () => undefined);
    expect(attributes['url.full']).toBe('/a?b=1');
    const sent = (inner.export.mock.calls[0] as [ReadableSpan[]])[0][0];
    expect(sent?.attributes.other).toBe('x?y');
  });
});
