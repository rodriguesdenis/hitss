import { Global, Module } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

@Global()
@Module({
  providers: [
    {
      provide: GlobalExceptionFilter,
      inject: [Logger],
      useFactory: (logger: Logger) =>
        new GlobalExceptionFilter({
          logger: {
            error: (entry) => logger.error(entry, GlobalExceptionFilter.name),
          },
        }),
    },
  ],
  exports: [GlobalExceptionFilter],
})
export class HttpConventionsModule {}
