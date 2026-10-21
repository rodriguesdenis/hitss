import {
  ArgumentMetadata,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import {
  RequestValidationException,
  ValidationDetail,
} from '../filters/api-exception';

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
 * object, so `__proto__` / `constructor` never reach a DTO (AC-01.6.6). Input nested deeper than
 * 32 levels is refused first, so no recursive walk can overflow the stack (Lynx S1).
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
      const found = scan(value);
      if (found && 'tooDeep' in found) {
        throw new RequestValidationException([
          {
            field: metadata.type,
            message: `${metadata.type} is nested too deeply`,
          },
        ]);
      }
      if (found) {
        const field = found.prototypeKey;
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

/** Deeper input is refused before any recursive library (class-transformer) walks it. */
const MAX_DEPTH = 32;

type ScanResult = { prototypeKey: string } | { tooDeep: true } | undefined;

/**
 * Walks a JSON value without recursion (no stack overflow on hostile input) and returns the
 * dotted path of the first prototype key, or `tooDeep` beyond MAX_DEPTH nested objects/arrays.
 */
function scan(value: unknown): ScanResult {
  const stack: { value: unknown; path: string; depth: number }[] = [
    { value, path: '', depth: 1 },
  ];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (typeof current.value !== 'object' || current.value === null) {
      continue;
    }
    if (current.depth > MAX_DEPTH) {
      return { tooDeep: true };
    }
    const keys = Object.keys(current.value);
    for (const key of keys) {
      if (PROTOTYPE_KEYS.has(key)) {
        return {
          prototypeKey: current.path === '' ? key : `${current.path}.${key}`,
        };
      }
    }
    // Reversed, so that keys are visited in their own order (the first offender is reported).
    for (const key of keys.reverse()) {
      stack.push({
        value: (current.value as Record<string, unknown>)[key],
        path: current.path === '' ? key : `${current.path}.${key}`,
        depth: current.depth + 1,
      });
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
