import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { OtelTaskMetrics } from './otel-task-metrics.adapter';

async function collect(act: (adapter: OtelTaskMetrics) => void) {
  const exporter = new InMemoryMetricExporter(
    AggregationTemporality.CUMULATIVE,
  );
  const reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: 60_000,
  });
  const provider = new MeterProvider({ readers: [reader] });
  act(new OtelTaskMetrics(provider.getMeter('teams-tasks-api')));
  await provider.forceFlush();
  const points = exporter
    .getMetrics()
    .flatMap((m) => m.scopeMetrics.flatMap((s) => s.metrics))
    .map((metric) => ({
      name: metric.descriptor.name,
      points: metric.dataPoints.map((p) => ({
        value: p.value,
        attributes: p.attributes,
      })),
    }));
  await provider.shutdown();
  return points;
}

describe('OtelTaskMetrics', () => {
  it('AC-06.4.2 AC-06.4.3 AC-06.4.5 exports the three counters, summed, without attributes', async () => {
    const result = await collect((a) => {
      a.taskCreated();
      a.taskCreated();
      a.taskCompleted();
      a.taskDeleted();
    });

    expect(result).toEqual([
      { name: 'tasks_created_total', points: [{ value: 2, attributes: {} }] },
      { name: 'tasks_completed_total', points: [{ value: 1, attributes: {} }] },
      { name: 'tasks_deleted_total', points: [{ value: 1, attributes: {} }] },
    ]);
  });

  it('AC-06.4.4 only the three task counters exist', async () => {
    const result = await collect((a) => a.taskCreated());
    expect(result.map((m) => m.name)).toEqual(['tasks_created_total']);
  });
});
