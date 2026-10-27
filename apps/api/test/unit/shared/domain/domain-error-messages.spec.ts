import type { ArgumentsHost } from '@nestjs/common';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DomainError } from '../../../../src/shared/domain/domain-error';
import {
  ErrorEnvelope,
  GlobalExceptionFilter,
} from '../../../../src/shared/presentation/filters/global-exception.filter';

type ErrorClass = new (...args: unknown[]) => DomainError;

const MODULES = join(__dirname, '../../../../src/modules');

function errorFiles(): string[] {
  return readdirSync(MODULES).flatMap((module) => {
    const dir = join(MODULES, module, 'domain/errors');
    try {
      return readdirSync(dir)
        .filter((file) => file.endsWith('.errors.ts'))
        .map((file) => join(dir, file));
    } catch {
      return [];
    }
  });
}

async function declaredErrors(): Promise<[string, ErrorClass][]> {
  const found: [string, ErrorClass][] = [];
  for (const file of errorFiles()) {
    const exports = (await import(file)) as Record<string, unknown>;
    for (const [name, value] of Object.entries(exports)) {
      if (
        typeof value === 'function' &&
        value.prototype instanceof DomainError
      ) {
        found.push([name, value as ErrorClass]);
      }
    }
  }
  return found;
}

const hostile = (ctor: ErrorClass, secret: string): DomainError =>
  new ctor(...Array.from({ length: ctor.length }, () => secret));

function bodyOf(exception: unknown): string {
  let body: ErrorEnvelope | undefined;
  const response = {
    status: () => response,
    json: (sent: ErrorEnvelope) => {
      body = sent;
      return response;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ id: 'req-1' }),
    }),
  } as unknown as ArgumentsHost;
  new GlobalExceptionFilter({
    logger: { error: () => undefined },
    activeSpan: () => undefined,
  }).catch(exception, host);
  return JSON.stringify(body);
}

describe('Every declared domain error (Lynx S2)', () => {
  it('finds the module error classes', async () => {
    const names = (await declaredErrors()).map(([name]) => name);

    expect(names).toEqual(
      expect.arrayContaining(['TaskNotFound', 'UnknownTeams', 'TeamNotFound']),
    );
  });

  it('AC-09.6 has a fixed message that never echoes its constructor arguments', async () => {
    for (const [name, ctor] of await declaredErrors()) {
      const first = hostile(ctor, 'secret-value-1');
      const second = hostile(ctor, 'secret-value-2');

      expect([name, first.message]).toEqual([name, second.message]);
      expect([name, first.message]).not.toEqual([
        name,
        expect.stringContaining('secret-value'),
      ]);
    }
  });

  it('AC-09.6 never puts a constructor argument in the message of the HTTP body', async () => {
    for (const [name, ctor] of await declaredErrors()) {
      const error = hostile(ctor, 'secret-value-1');
      const body = JSON.parse(bodyOf(error)) as ErrorEnvelope;

      expect([name, body.error.message]).toEqual([name, error.message]);
      expect([name, body.error.code]).toEqual([name, error.code]);
      expect([
        name,
        JSON.stringify({ ...body.error, details: undefined }),
      ]).not.toEqual([name, expect.stringContaining('secret-value')]);
    }
  });
});
