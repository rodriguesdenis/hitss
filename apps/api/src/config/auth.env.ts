import { Transform } from 'class-transformer';
import {
  buildMessage,
  IsIn,
  IsInt,
  isIP,
  Max,
  Min,
  ValidateBy,
} from 'class-validator';
import { TelemetryEnv } from './telemetry.env';
import {
  atMostMaxRateLimit,
  integer,
  isBoolean,
  MAX_RATE_LIMIT,
  toBoolean,
  toList,
  toNumber,
} from './transforms';

export function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

const isHttp = (url: URL): boolean =>
  url.protocol === 'http:' || url.protocol === 'https:';

const isAbsoluteHttpUrl = (value: string): boolean => {
  const url = parseUrl(value);
  return (
    url !== null && isHttp(url) && url.username === '' && url.password === ''
  );
};

const isCorsOrigin = (item: string): boolean => {
  if (item === '*') {
    return true;
  }
  const url = parseUrl(item);
  return url !== null && isHttp(url) && url.origin === item;
};

export interface ProxyRange {
  family: 4 | 6;
  prefix: number;
}

export function parseProxy(item: string): ProxyRange | null {
  const [address = '', prefix, ...rest] = item.split('/');
  const family = isIP(address, 4) ? 4 : isIP(address, 6) ? 6 : null;
  if (family === null || rest.length > 0) {
    return null;
  }
  const maxPrefix = family === 4 ? 32 : 128;
  if (prefix === undefined) {
    return asIpv4IfMapped(address, { family, prefix: maxPrefix });
  }
  if (!/^\d{1,3}$/.test(prefix) || Number(prefix) > maxPrefix) {
    return null;
  }
  return asIpv4IfMapped(address, { family, prefix: Number(prefix) });
}

const IPV4_MAPPED = /^::ffff:\d{1,3}(\.\d{1,3}){3}$/i;

function asIpv4IfMapped(address: string, range: ProxyRange): ProxyRange {
  return range.family === 6 && IPV4_MAPPED.test(address)
    ? { family: 4, prefix: range.prefix - 96 }
    : range;
}

const isNarrowerThanEverything = (item: string): boolean => {
  const range = parseProxy(item);
  return range !== null && range.prefix > 0;
};

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

export class AuthEnvironmentVariables extends TelemetryEnv {
  @Satisfies(
    'isAbsoluteHttpUrl',
    isAbsoluteHttpUrl,
    'must be an absolute http(s) URL without credentials',
  )
  BETTER_AUTH_URL: string = 'http://localhost:3000';

  @Transform(toList)
  @EveryItem(
    'isCorsOriginList',
    isCorsOrigin,
    'must be a comma-separated list of http(s) origins (scheme://host[:port] as browsers send them, without credentials or path), or *',
  )
  CORS_ORIGINS: string[] = ['http://localhost:8081'];

  @Satisfies(
    'isAppScheme',
    isAppScheme,
    'must be a lower-case custom URL scheme like teamstasks; web, file and Expo Go schemes are reserved',
  )
  APP_SCHEME: string = 'teamstasks';

  @Transform(toList)
  @EveryItem(
    'isAddressOrCidrList',
    isNarrowerThanEverything,
    'must be a comma-separated list of IP addresses or CIDR ranges, none of them /0',
  )
  TRUSTED_PROXIES: string[] = [];

  @Transform(toBoolean)
  @IsIn([true, false], isBoolean)
  AUTH_RATE_LIMIT_ENABLED: boolean = true;

  @Transform(toNumber)
  @IsInt(integer)
  @Min(1, { message: 'must be at least 1' })
  @Max(MAX_RATE_LIMIT, atMostMaxRateLimit)
  @ValidateBy({
    name: 'isAtLeastRateLimitMax',
    validator: {
      validate: (value: unknown, args) => {
        const userMax = (args?.object as { RATE_LIMIT_MAX?: unknown })
          .RATE_LIMIT_MAX;
        return (
          typeof value !== 'number' ||
          typeof userMax !== 'number' ||
          value >= userMax
        );
      },
      defaultMessage: buildMessage(
        () =>
          'must be greater than or equal to RATE_LIMIT_MAX, or the per-user limit can never be reached',
      ),
    },
  })
  RATE_LIMIT_IP_MAX: number = 300;

  @Transform(toBoolean)
  @IsIn([true, false], isBoolean)
  SEED_DEMO: boolean = true;

  @Transform(toBoolean)
  @IsIn([true, false], isBoolean)
  DOCS_ENABLED: boolean = true;
}
