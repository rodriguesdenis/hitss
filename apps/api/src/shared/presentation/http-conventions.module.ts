import { Global, Module, OnModuleInit } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { DomainErrorMappings } from './filters/domain-error-mappings';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { SHARED_ERROR_MAPPINGS } from './filters/shared-error.mapping';

/**
 * Container side of the HTTP conventions: the domain-error registry modules register into, and
 * the exception filter built from it and the pino logger. setupApp() takes the filter from here.
 */
@Global()
@Module({
  providers: [
    DomainErrorMappings,
    {
      provide: GlobalExceptionFilter,
      inject: [DomainErrorMappings, Logger],
      useFactory: (mappings: DomainErrorMappings, logger: Logger) =>
        new GlobalExceptionFilter({
          mappings,
          logger: {
            error: (entry) => logger.error(entry, GlobalExceptionFilter.name),
          },
        }),
    },
  ],
  exports: [DomainErrorMappings, GlobalExceptionFilter],
})
export class HttpConventionsModule implements OnModuleInit {
  constructor(private readonly mappings: DomainErrorMappings) {}

  /** The shared kernel's errors (ConcurrencyConflict → 412); contexts register their own. */
  onModuleInit(): void {
    this.mappings.register(SHARED_ERROR_MAPPINGS);
  }
}
