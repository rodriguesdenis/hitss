import {
  ArgumentMetadata,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import {
  RequestValidationException,
  ValidationDetail,
} from './filters/api-exception';

/** Keys that could reach an object's prototype; never valid in a request, at any depth. */
const PROTOTYPE_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * The global pipe (ADR-0005): unknown fields are rejected (`whitelist` +
 * `forbidNonWhitelisted`), values are transformed to DTO instances, and every failure becomes
 * `400 VALIDATION_FAILED` with `details: [{ field, message }]`. Before class-transformer sees the
 * input, prototype keys anywhere in a body or query are rejected and a DTO body must be a JSON
 * object, so `__proto__` / `constructor` never reach a DTO (AC-01.6.6).
 */
export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      exceptionFactory: (errors) =>
        new RequestValidationException(toDetails(errors)),
    });
  }

  override async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    if (metadata.type === 'body' || metadata.type === 'query') {
      const field = prototypeKeyPath(value);
      if (field !== undefined) {
        const key = field.split('.').pop() ?? field;
        throw new RequestValidationException([
          { field, message: `property ${key} should not exist` },
        ]);
      }
    }
    if (
      metadata.type === 'body' &&
      this.toValidate(metadata) &&
      !isPlainObject(value)
    ) {
      throw new RequestValidationException([
        { field: 'body', message: 'body must be a JSON object' },
      ]);
    }
    return super.transform(value, metadata);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Dotted path of the first prototype key found in a JSON value, if any. */
function prototypeKeyPath(value: unknown, path = ''): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  for (const key of Object.keys(value)) {
    const keyPath = path === '' ? key : `${path}.${key}`;
    if (PROTOTYPE_KEYS.has(key)) {
      return keyPath;
    }
    const nested = prototypeKeyPath(
      (value as Record<string, unknown>)[key],
      keyPath,
    );
    if (nested !== undefined) {
      return nested;
    }
  }
  return undefined;
}

/** One detail per broken rule; nested properties get a dotted path (`child.label`). */
function toDetails(errors: ValidationError[], parent = ''): ValidationDetail[] {
  return errors.flatMap((error) => {
    const field =
      parent === '' ? error.property : `${parent}.${error.property}`;
    return [
      ...Object.values(error.constraints ?? {}).map((message) => ({
        field,
        message,
      })),
      ...toDetails(error.children ?? [], field),
    ];
  });
}
