import { HttpException } from '@nestjs/common';
import { ErrorCode } from './error-codes';

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

const cap = (text: string): string =>
  [...text].slice(0, MAX_DETAIL_LENGTH).join('');

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
