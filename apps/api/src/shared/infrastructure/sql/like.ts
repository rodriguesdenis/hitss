export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function containsPattern(term: string): string {
  return `%${escapeLike(term)}%`;
}
