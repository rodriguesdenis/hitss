import type { OpenAPIObject } from '@nestjs/swagger';
import type { DomainError } from '../../src/shared/domain/domain-error';
import { DOMAIN_ERROR_STATUS } from '../../src/shared/presentation/filters/global-exception.filter';

export interface ErrorPlacement {
  undocumented: string[];
  misplaced: string[];
}

export function placementOf(
  doc: OpenAPIObject,
  errors: readonly DomainError[],
): ErrorPlacement {
  const documented = new Set<string>();
  const misplaced: string[] = [];
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      const responses = (operation as { responses?: object }).responses ?? {};
      for (const [status, response] of Object.entries(responses)) {
        const description = (response as { description?: string }).description;
        for (const error of errors) {
          if (!new RegExp(`\\b${error.code}\\b`).test(description ?? '')) {
            continue;
          }
          documented.add(error.code);
          if (Number(status) !== DOMAIN_ERROR_STATUS[error.kind]) {
            misplaced.push(`${method} ${path} ${status} ${error.code}`);
          }
        }
      }
    }
  }
  return {
    undocumented: [
      ...new Set(
        errors.map(({ code }) => code).filter((c) => !documented.has(c)),
      ),
    ],
    misplaced,
  };
}
