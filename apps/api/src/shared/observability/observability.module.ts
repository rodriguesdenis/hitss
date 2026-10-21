import { Module } from '@nestjs/common';
import { TelemetryShutdown } from './telemetry/telemetry-shutdown';

/** Observability wiring shared by the whole API. Imported once by AppModule. */
@Module({ providers: [TelemetryShutdown] })
export class ObservabilityModule {}
