import { Transform } from 'class-transformer';
import {
  buildMessage,
  IsIn,
  IsInt,
  isIP,
  IsUrl,
  Min,
  ValidateBy,
} from 'class-validator';
import { TelemetryEnv } from './telemetry.env';
import { integer, isBoolean, toBoolean, toList, toNumber } from './transforms';

/** `scheme://host[:port]` with no path, as browsers send in the Origin header. */
const HTTP_ORIGIN = /^https?:\/\/[^\s/?#]+$/;

const isCorsOrigin = (item: string): boolean =>
  item === '*' || HTTP_ORIGIN.test(item);

export interface ProxyRange {
  family: 4 | 6;
  /** CIDR prefix length; a single address is a full-length prefix. */
  prefix: number;
}

/** Parses an IPv4/IPv6 address, optionally with a CIDR prefix length (Express `trust proxy`). */
export function parseProxy(item: string): ProxyRange | null {
  const [address = '', prefix, ...rest] = item.split('/');
  const family = isIP(address, 4) ? 4 : isIP(address, 6) ? 6 : null;
  if (family === null || rest.length > 0) {
    return null;
  }
  const maxPrefix = family === 4 ? 32 : 128;
  if (prefix === undefined) {
    return { family, prefix: maxPrefix };
  }
  if (!/^\d{1,3}$/.test(prefix) || Number(prefix) > maxPrefix) {
    return null;
  }
  return { family, prefix: Number(prefix) };
}

/** A /0 range would trust X-Forwarded-For from anywhere, in every environment. */
const isNarrowerThanEverything = (item: string): boolean => {
  const range = parseProxy(item);
  return range !== null && range.prefix > 0;
};

/**
 * Schemes that must never be trusted as the app's deep-link scheme: Better Auth matches trusted
 * origins by prefix, so `http` would trust every http:// origin. `exp`/`exps` are Expo Go's,
 * added by the auth module only for local development, never through APP_SCHEME.
 */
export const RESERVED_SCHEMES: ReadonlySet<string> = new Set([
  'http',
  'https',
  'ws',
  'wss',
  'file',
  'ftp',
  'data',
  'javascript',
  'blob',
  'about',
  'exp',
  'exps',
]);

const isAppScheme = (value: string): boolean =>
  /^[a-z][a-z0-9+.-]*$/.test(value) && !RESERVED_SCHEMES.has(value);

/** The value is a string that passes `check`. The message never contains the value. */
function Satisfies(
  name: string,
  check: (value: string) => boolean,
  message: string,
): PropertyDecorator {
  return ValidateBy({
    name,
    validator: {
      validate: (value: unknown) => typeof value === 'string' && check(value),
      defaultMessage: buildMessage(() => message),
    },
  });
}

/** Every item of a parsed list passes `check`. The message never contains a value. */
function EveryItem(
  name: string,
  check: (item: string) => boolean,
  message: string,
): PropertyDecorator {
  return ValidateBy({
    name,
    validator: {
      validate: (value: unknown) =>
        Array.isArray(value) &&
        value.every((item) => typeof item === 'string' && check(item)),
      defaultMessage: buildMessage(() => message),
    },
  });
}

/**
 * Auth and security settings (spec 001, T-001-01). Inherited by `EnvironmentVariables` (and
 * inheriting the telemetry settings), so the T-007-02 `validate()` covers them; production-only
 * rules live in `production-rules.ts`.
 */
export class AuthEnvironmentVariables extends TelemetryEnv {
  /** Public base URL of the API, used by Better Auth for callbacks and cookies. */
  @IsUrl(
    {
      require_tld: false,
      require_protocol: true,
      protocols: ['http', 'https'],
    },
    { message: 'must be an absolute http(s) URL' },
  )
  BETTER_AUTH_URL: string = 'http://localhost:3000';

  /** Browser origins allowed by CORS (comma-separated). */
  @Transform(toList)
  @EveryItem(
    'isCorsOriginList',
    isCorsOrigin,
    'must be a comma-separated list of http(s) origins without a path, or *',
  )
  CORS_ORIGINS: string[] = ['http://localhost:8081'];

  /** Deep-link scheme of the mobile app, trusted as an origin by Better Auth. */
  @Satisfies(
    'isAppScheme',
    isAppScheme,
    'must be a lower-case custom URL scheme like teamstasks; web, file and Expo Go schemes are reserved',
  )
  APP_SCHEME: string = 'teamstasks';

  /** Reverse proxies whose X-Forwarded-For is trusted (comma-separated IPs or CIDRs). */
  @Transform(toList)
  @EveryItem(
    'isAddressOrCidrList',
    isNarrowerThanEverything,
    'must be a comma-separated list of IP addresses or CIDR ranges, none of them /0',
  )
  TRUSTED_PROXIES: string[] = [];

  /** Better Auth's own rate limiter on /api/auth/*. */
  @Transform(toBoolean)
  @IsIn([true, false], isBoolean)
  AUTH_RATE_LIMIT_ENABLED: boolean = true;

  /** Requests per minute per client IP, checked before authentication. */
  @Transform(toNumber)
  @IsInt(integer)
  @Min(1, { message: 'must be at least 1' })
  RATE_LIMIT_IP_MAX: number = 300;

  /** Create the demo account when seeding. */
  @Transform(toBoolean)
  @IsIn([true, false], isBoolean)
  SEED_DEMO: boolean = true;

  /** Serve /docs and /docs/openapi.json; always off in production (see toAppConfig). */
  @Transform(toBoolean)
  @IsIn([true, false], isBoolean)
  DOCS_ENABLED: boolean = true;
}
