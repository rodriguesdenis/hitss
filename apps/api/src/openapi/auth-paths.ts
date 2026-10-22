import type {
  HeadersObject,
  OpenAPIObject,
  SecurityRequirementObject,
} from '@nestjs/swagger';

type Paths = NonNullable<OpenAPIObject['paths']>;

export const IDENTITY_TAG = 'Identity';
const SESSION_SECURITY: SecurityRequirementObject[] = [{ bearer: [] }];

const credentials = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email', example: 'demo@teams-tasks.dev' },
    password: { type: 'string', minLength: 8, maxLength: 128 },
  },
} as const;

const user = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    emailVerified: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const session = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string', format: 'uuid' },
    expiresAt: { type: 'string', format: 'date-time' },
  },
} as const;

const body = (schema: object) => ({
  required: true,
  content: { 'application/json': { schema } },
});

const json = (
  description: string,
  schema: object,
  headers?: HeadersObject,
) => ({
  description,
  ...(headers && { headers }),
  content: { 'application/json': { schema } },
});

const SET_AUTH_TOKEN: HeadersObject = {
  'set-auth-token': {
    description:
      'Signed session token. Send it as `Authorization: Bearer <token>` (mobile and API clients).',
    schema: { type: 'string' },
  },
};

export const AUTH_PATHS: Paths = {
  '/api/auth/sign-up/email': {
    post: {
      tags: [IDENTITY_TAG],
      summary: 'Create an account and sign in',
      security: [],
      requestBody: body({
        ...credentials,
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', example: 'Ada Lovelace' },
          ...credentials.properties,
        },
      }),
      responses: {
        '200': json(
          'Account created; the session is returned and set as a cookie.',
          { type: 'object', properties: { token: { type: 'string' }, user } },
          SET_AUTH_TOKEN,
        ),
        '422': {
          description: 'Invalid input or the email is already registered.',
        },
        '429': { description: 'Rate limited.' },
      },
    },
  },
  '/api/auth/sign-in/email': {
    post: {
      tags: [IDENTITY_TAG],
      summary: 'Sign in with email and password',
      security: [],
      requestBody: body(credentials),
      responses: {
        '200': json(
          'Signed in; the session is set as a cookie and the token is returned.',
          { type: 'object', properties: { token: { type: 'string' }, user } },
          SET_AUTH_TOKEN,
        ),
        '401': { description: 'Invalid email or password.' },
        '429': { description: 'Rate limited.' },
      },
    },
  },
  '/api/auth/sign-out': {
    post: {
      tags: [IDENTITY_TAG],
      summary: 'Revoke the current session',
      security: SESSION_SECURITY,
      responses: {
        '200': json('Session revoked.', {
          type: 'object',
          properties: { success: { type: 'boolean' } },
        }),
      },
    },
  },
  '/api/auth/get-session': {
    get: {
      tags: [IDENTITY_TAG],
      summary: 'The current session and user, or null',
      security: SESSION_SECURITY,
      responses: {
        '200': json('The session, or `null` when anonymous.', {
          type: 'object',
          nullable: true,
          properties: { session, user },
        }),
      },
    },
  },
};
