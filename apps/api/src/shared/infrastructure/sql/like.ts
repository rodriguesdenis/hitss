/**
 * Escapes a user term for `LIKE`/`ILIKE … ESCAPE '\'`, so `%` and `_` match literally (no
 * wildcard semantics, AC-02.3.3). The backslash is escaped first.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** `%term%` for a substring match, with the term escaped; use with `ESCAPE '\'`. */
export function containsPattern(term: string): string {
  return `%${escapeLike(term)}%`;
}
