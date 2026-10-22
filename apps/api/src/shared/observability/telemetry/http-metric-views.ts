import {
  createAllowListAttributesProcessor,
  type ViewOptions,
} from '@opentelemetry/sdk-metrics';

/**
 * Request duration histograms, by current and legacy semantic-convention names, so that
 * OTEL_SEMCONV_STABILITY_OPT_IN=http/dup (or the old mode) never exports an unfiltered one.
 */
export const HTTP_DURATION_METRICS = [
  'http.server.request.duration',
  'http.client.request.duration',
  'http.server.duration',
  'http.client.duration',
];

/** The only dimensions allowed on them: bounded, no client-controlled values (AC-06.4.4). */
export const HTTP_METRIC_ATTRIBUTES = [
  'http.request.method',
  'http.route',
  'http.response.status_code',
  'error.type',
];

export function httpMetricViews(): ViewOptions[] {
  return HTTP_DURATION_METRICS.map((instrumentName) => ({
    instrumentName,
    attributesProcessors: [
      createAllowListAttributesProcessor(HTTP_METRIC_ATTRIBUTES),
    ],
  }));
}
