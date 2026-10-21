/**
 * Path without query string or fragment. Query strings can carry tokens (`/api/auth/*`) or
 * search terms, so no URL is ever logged with one (AC-06.3.7).
 */
export function sanitizeUrl(url: string): string {
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}
