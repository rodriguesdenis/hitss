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

const MAX_DEPTH = 3;

const HEADERS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'res.headers["set-auth-token"]',
];

const accessor = (field: string) =>
  /^[A-Za-z_$][\w$]*$/.test(field) ? `.${field}` : `["${field}"]`;

export const REDACT_PATHS: string[] = [
  ...HEADERS,
  ...SECRET_FIELDS.flatMap((field) => [
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
