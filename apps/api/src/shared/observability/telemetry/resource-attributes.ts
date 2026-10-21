/** Parses the OTEL_RESOURCE_ATTRIBUTES `key=value,key=value` format; malformed pairs are skipped. */
export function parseResourceAttributes(raw: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key && value) attributes[key] = value;
  }
  return attributes;
}
