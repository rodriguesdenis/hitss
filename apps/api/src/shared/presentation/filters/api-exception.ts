import { HttpException } from '@nestjs/common';
import { ErrorCode } from './error-codes';

/** An HTTP error raised on purpose, with a contract code and a message meant for the client. */
export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message, status);
  }
}

export interface ValidationDetail {
  field: string;
  message: string;
}

/** Request validation failed (ValidationPipe): 400 VALIDATION_FAILED with one detail per rule. */
export class RequestValidationException extends ApiException {
  constructor(details: ValidationDetail[]) {
    super(
      400,
      ErrorCode.VALIDATION_FAILED,
      'Request validation failed.',
      details,
    );
  }
}
