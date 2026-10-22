import type { OpenAPIObject } from '@nestjs/swagger';

const ERROR_SCHEMA_REF = '#/components/schemas/ApiErrorResponseDto';
const METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'patch',
  'options',
  'head',
  'trace',
] as const;

type Json = Record<string, unknown>;

function collectRefs(
  value: unknown,
  at: string,
  out: [string, string][],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectRefs(item, `${at}[${index}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Json)) {
      if (key === '$ref' && typeof child === 'string') {
        out.push([child, at]);
      } else {
        collectRefs(child, `${at}.${key}`, out);
      }
    }
  }
}

function resolves(document: OpenAPIObject, ref: string): boolean {
  if (!ref.startsWith('#/')) {
    return false;
  }
  let node: unknown = document;
  for (const segment of ref.slice(2).split('/')) {
    if (!node || typeof node !== 'object' || !(segment in (node as Json))) {
      return false;
    }
    node = (node as Json)[segment];
  }
  return node !== undefined;
}

export function openApiProblems(
  document: OpenAPIObject,
  nativeTags: readonly string[] = [],
): string[] {
  const problems: string[] = [];
  if (!document.openapi?.startsWith('3.')) {
    problems.push(`openapi version ${String(document.openapi)} is not 3.x`);
  }
  if (!document.info?.title || !document.info.version) {
    problems.push('info.title and info.version are required');
  }

  const refs: [string, string][] = [];
  collectRefs(document, '#', refs);
  for (const [ref, at] of refs) {
    if (!resolves(document, ref)) {
      problems.push(`unresolved $ref ${ref} at ${at}`);
    }
  }

  const operationIds = new Map<string, string>();
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    const templated = [...path.matchAll(/\{([^}]+)\}/g)].map(
      (match) => match[1] ?? '',
    );
    for (const method of METHODS) {
      const operation = (item as Json)[method] as Json | undefined;
      if (!operation) {
        continue;
      }
      const where = `${method.toUpperCase()} ${path}`;
      const parameters = (
        (operation.parameters as Json[] | undefined) ?? []
      ).filter((parameter) => parameter.in === 'path');
      const declared = parameters.map((parameter) => String(parameter.name));
      for (const name of templated) {
        if (!declared.includes(name)) {
          problems.push(`${where}: path parameter {${name}} is not declared`);
        }
      }
      for (const parameter of parameters) {
        if (!templated.includes(String(parameter.name))) {
          problems.push(
            `${where}: path parameter ${String(parameter.name)} is not in the path`,
          );
        }
        if (parameter.required !== true) {
          problems.push(
            `${where}: path parameter ${String(parameter.name)} must be required`,
          );
        }
      }

      const operationId = operation.operationId as string | undefined;
      if (operationId) {
        const previous = operationIds.get(operationId);
        if (previous) {
          problems.push(
            `${where}: operationId ${operationId} already used by ${previous}`,
          );
        }
        operationIds.set(operationId, where);
      }

      const responses = (operation.responses as Json | undefined) ?? {};
      if (!Object.keys(responses).some((status) => /^2\d\d$/.test(status))) {
        problems.push(`${where}: no 2xx response`);
      }
      const native = ((operation.tags as string[] | undefined) ?? []).some(
        (tag) => nativeTags.includes(tag),
      );
      if (native) {
        continue;
      }
      for (const [status, response] of Object.entries(responses)) {
        const schema = (
          (response as Json).content as
            Record<string, { schema?: Json }> | undefined
        )?.['application/json']?.schema;
        if (
          /^[45]\d\d$/.test(status) &&
          schema &&
          schema.$ref !== ERROR_SCHEMA_REF
        ) {
          problems.push(
            `${where}: ${status} does not use the shared { error } schema`,
          );
        }
      }
    }
  }
  return problems;
}
