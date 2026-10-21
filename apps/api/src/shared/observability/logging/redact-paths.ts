/** Field names that may carry credentials; matched at every depth up to MAX_DEPTH. */
const SECRET_FIELDS = [
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'secret',
  'email',
  'accessToken',
  'refreshToken',
  'idToken',
  'sessionToken',
  'apiKey',
  'authorization',
  'Authorization',
  'cookie',
  'Cookie',
  'set-cookie',
  'set-auth-token',
  'connectionString',
  'databaseUrl',
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
] as const;

/** pino wildcards match one level, so each pattern is repeated for depths 1 to 3 (and 0 for top level). */
const MAX_DEPTH = 3;

const HEADERS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'res.headers["set-auth-token"]',
];

/** Dotted for plain identifiers; bracket form for names such as `set-cookie`. */
const accessor = (field: string) =>
  /^[A-Za-z_$][\w$]*$/.test(field) ? `.${field}` : `["${field}"]`;

/** Single source for the logger config and its tests (security decision S-M8, threat model I-03). */
export const REDACT_PATHS: string[] = [
  ...HEADERS,
  ...SECRET_FIELDS.flatMap((field) => [
    // depth 0 (top level) and wildcard prefixes of one to MAX_DEPTH levels
    /^[A-Za-z_$][\w$]*$/.test(field) ? field : `["${field}"]`,
    ...Array.from(
      { length: MAX_DEPTH },
      (_, depth) =>
        `${Array<string>(depth + 1)
          .fill('*')
          .join('.')}${accessor(field)}`,
    ),
  ]),
];

export const REDACTED = '[REDACTED]';
