/** Field names that may carry credentials; matched at every depth up to MAX_DEPTH. */
const SECRET_FIELDS = [
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'secret',
  'email',
] as const;

/** pino wildcards match one level, so each pattern is repeated for depths 1 to 3 (and 0 for top level). */
const MAX_DEPTH = 3;

const HEADERS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'res.headers["set-auth-token"]',
];

/** Single source for the logger config and its tests (security decision S-M8, threat model I-03). */
export const REDACT_PATHS: string[] = [
  ...HEADERS,
  ...SECRET_FIELDS.flatMap((field) => [
    field,
    ...Array.from({ length: MAX_DEPTH }, (_, depth) =>
      [...Array<string>(depth + 1).fill('*'), field].join('.'),
    ),
  ]),
];

export const REDACTED = '[REDACTED]';
