import type { ExportResult } from '@opentelemetry/core';
import type * as tracing from '@opentelemetry/sdk-trace';

type ReadableSpan = tracing.ReadableSpan;
type SpanExporter = tracing.SpanExporter;
import { sanitizeUrl } from '../sanitize-url';

/** Attributes holding a URL or target in old and new HTTP semantic conventions. */
const URL_ATTRIBUTES = ['url.full', 'http.url', 'http.target'];
/** Attributes that exist only to carry the query string. */
const QUERY_ATTRIBUTES = ['url.query', 'http.query'];

function sanitizeAttributes(
  attributes: ReadableSpan['attributes'],
): ReadableSpan['attributes'] {
  const clean = { ...attributes };
  for (const key of QUERY_ATTRIBUTES) delete clean[key];
  for (const key of URL_ATTRIBUTES) {
    const value = clean[key];
    if (typeof value === 'string') clean[key] = sanitizeUrl(value);
  }
  return clean;
}

/**
 * Last line of defence for AC-06.2.5: whichever instrumentation recorded a URL (http, nestjs-core,
 * a future one), query strings (tokens, search terms) never leave the process. Wraps spans
 * instead of mutating them so other processors see the originals.
 */
export class SanitizingSpanExporter implements SpanExporter {
  constructor(private readonly inner: SpanExporter) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    const clean = spans.map(
      (span): ReadableSpan =>
        Object.create(span, {
          attributes: { value: sanitizeAttributes(span.attributes) },
        }) as ReadableSpan,
    );
    this.inner.export(clean, resultCallback);
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.inner.forceFlush?.() ?? Promise.resolve();
  }
}
