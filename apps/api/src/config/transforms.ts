/** class-transformer / class-validator helpers shared by the environment classes. */
export const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export const toNumber = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

/** "a, b,,c" → ["a", "b", "c"]; an empty string is an empty list. */
export const toList = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '')
    : value;

export const isBoolean = { message: 'must be "true" or "false"' };
export const integer = { message: 'must be an integer' };
export const oneOf = (values: readonly string[]) => ({
  message: `must be one of: ${values.join(', ')}`,
});

/** Upper bound of the per-minute rate limits: higher values disable the limiter in practice. */
export const MAX_RATE_LIMIT = 10_000;
export const atMostMaxRateLimit = {
  message: `must be at most ${MAX_RATE_LIMIT}`,
};
