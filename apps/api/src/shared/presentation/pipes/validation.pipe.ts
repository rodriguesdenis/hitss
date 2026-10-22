import {
  ArgumentMetadata,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import {
  RequestValidationException,
  ValidationDetail,
} from '../filters/api-exception';

const PROTOTYPE_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

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

const MAX_DEPTH = 32;

type ScanResult = { prototypeKey: string } | { tooDeep: true } | undefined;

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
