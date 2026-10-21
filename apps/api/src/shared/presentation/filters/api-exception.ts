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

const MAX_DETAILS = 50;
const MAX_DETAIL_LENGTH = 100;

/** At most MAX_DETAIL_LENGTH characters (code points: an emoji is never split). */
const cap = (text: string): string =>
  [...text].slice(0, MAX_DETAIL_LENGTH).join('');

/**
 * Request validation failed (ValidationPipe, ParseUuidPipe): 400 VALIDATION_FAILED with one
 * detail per rule. At most 50 details, each field and message capped to 100 characters, so a
 * hostile body cannot inflate the error response.
 */
export class RequestValidationException extends ApiException {
  declare readonly details: ValidationDetail[];

  constructor(details: ValidationDetail[]) {
    super(
      400,
      ErrorCode.VALIDATION_FAILED,
      'Request validation failed.',
      details.slice(0, MAX_DETAILS).map(({ field, message }) => ({
        field: cap(field),
        message: cap(message),
      })),
    );
  }
}
