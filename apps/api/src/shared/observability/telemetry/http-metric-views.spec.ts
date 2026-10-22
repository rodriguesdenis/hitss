import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import {
  HTTP_DURATION_METRICS,
  HTTP_METRIC_ATTRIBUTES,
  httpMetricViews,
} from './http-metric-views';

describe('HTTP metric views', () => {
  it('AC-06.4.4 cover the current and the legacy request duration instruments', () => {
    expect(HTTP_DURATION_METRICS).toEqual(
      expect.arrayContaining([
        'http.server.request.duration',
        'http.client.request.duration',
        'http.server.duration',
        'http.client.duration',
      ]),
    );
    expect(httpMetricViews().map((v) => v.instrumentName)).toEqual(
      HTTP_DURATION_METRICS,
    );
  });

  it.each(HTTP_DURATION_METRICS)(
    'AC-06.4.4 %s keeps only the allowlisted attributes',
    async (name) => {
      const exporter = new InMemoryMetricExporter(
        AggregationTemporality.CUMULATIVE,
      );
      const provider = new MeterProvider({
        readers: [
          new PeriodicExportingMetricReader({
            exporter,
            exportIntervalMillis: 60_000,
          }),
        ],
        views: httpMetricViews(),
      });
      provider.getMeter('test').createHistogram(name).record(0.1, {
        'http.request.method': 'GET',
        'http.route': '/api/v1/tasks/:id',
        'http.response.status_code': 200,
        'server.address': 'host-chosen-by-the-client.example.test',
        'url.scheme': 'http',
      });
      await provider.forceFlush();

      const points = exporter
        .getMetrics()
        .flatMap((m) => m.scopeMetrics.flatMap((s) => s.metrics))
        .flatMap(
          (metric) =>
            metric.dataPoints as { attributes: Record<string, unknown> }[],
        );
      expect(Object.keys(points[0]?.attributes ?? {}).sort()).toEqual(
        HTTP_METRIC_ATTRIBUTES.filter((k) => k !== 'error.type').sort(),
      );
      await provider.shutdown();
    },
  );
});
