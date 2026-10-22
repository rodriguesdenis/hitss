import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../shared/presentation/decorators/public.decorator';
import { RawResponse } from '../../shared/presentation/decorators/raw-response.decorator';
import { DatabaseReadiness } from './database-readiness';

interface StatusResponse {
  status(code: number): unknown;
}

@SkipThrottle({ ip: true, user: true })
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
