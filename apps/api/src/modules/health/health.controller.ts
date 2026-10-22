import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Public } from '../../shared/presentation/decorators/public.decorator';
import { RawResponse } from '../../shared/presentation/decorators/raw-response.decorator';
import { DatabaseReadiness } from './database-readiness';

/** The part of the HTTP response the probe sets (the Express type is a dev dependency). */
interface StatusResponse {
  status(code: number): unknown;
}

/**
 * Probes for the container orchestrator: public (AC-01.5.3), unwrapped, not logged or traced
 * (isProbe). Liveness touches nothing but the process (AC-06.1.1); readiness asks the database
 * and nothing else (BR-06.7), naming the failing check and nothing about the failure (AC-06.1.3).
 */
@Controller('health')
export class HealthController {
  constructor(private readonly readiness: DatabaseReadiness) {}

  @Get('live')
  @Public()
  @RawResponse()
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  @RawResponse()
  async ready(@Res({ passthrough: true }) response: StatusResponse): Promise<{
    status: 'ready' | 'unavailable';
    checks: { database: 'up' | 'down' };
  }> {
    const up = await this.readiness.check();
    if (!up) response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: up ? 'ready' : 'unavailable',
      checks: { database: up ? 'up' : 'down' },
    };
  }
}
