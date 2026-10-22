export const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export const blankToUndefined = ({ value }: { value: unknown }): unknown =>
  value === '' ? undefined : value;

export const toNumber = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

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

export const MAX_RATE_LIMIT = 10_000;
export const atMostMaxRateLimit = {
  message: `must be at most ${MAX_RATE_LIMIT}`,
};
