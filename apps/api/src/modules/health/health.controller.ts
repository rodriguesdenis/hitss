import { Controller, Get } from '@nestjs/common';
import { Public } from '../../shared/presentation/decorators/public.decorator';
import { RawResponse } from '../../shared/presentation/decorators/raw-response.decorator';

/**
 * Liveness for the container orchestrator: public (AC-01.5.3), unwrapped, and touching nothing
 * but the process. Readiness (database) comes with T-006-03; T-001-15 adds `@SkipThrottle()`.
 */
@Controller('health')
export class HealthController {
  @Get('live')
  @Public()
  @RawResponse()
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
