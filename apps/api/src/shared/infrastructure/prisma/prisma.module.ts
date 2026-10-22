import { Global, Module } from '@nestjs/common';
import {
  DATABASE_PROBE_TIMEOUT,
  DATABASE_PROBE_TIMEOUT_MS,
} from './database-probe';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    { provide: DATABASE_PROBE_TIMEOUT, useValue: DATABASE_PROBE_TIMEOUT_MS },
    PrismaService,
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
