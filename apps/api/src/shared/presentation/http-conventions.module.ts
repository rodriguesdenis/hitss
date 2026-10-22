import { Global, Module } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { DomainErrorMappings } from './filters/domain-error-mappings';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

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
export class HttpConventionsModule {}
