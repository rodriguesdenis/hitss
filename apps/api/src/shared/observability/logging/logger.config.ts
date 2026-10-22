import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DestinationStream } from 'pino';
import type { Params } from 'nestjs-pino';
import { isProbe } from '../is-probe';
import { REDACT_PATHS, REDACTED } from './redact-paths';
import { requestId } from './request-id';
import { routeOf, trackRouteTemplate } from './route-template';
import { sanitizeUrl } from '../sanitize-url';
import { traceFields } from './trace-fields';

export interface LoggerSettings {
  level: string;
  pretty: boolean;
}

export interface LoggerEnvironment {
  prettyAvailable?: () => boolean;
  warn?: (message: string) => void;
}

function isPinoPrettyInstalled(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

interface SerializedRequest {
  method?: string;
  url?: string;
}

type UserRequest = IncomingMessage & { id?: unknown; user?: { id?: unknown } };

function userIdOf(request: UserRequest): string | undefined {
  const id = request.user?.id;
  return typeof id === 'string' ? id : undefined;
}

export function createLoggerParams(
  { level, pretty }: LoggerSettings,
  destination?: DestinationStream,
  {
    prettyAvailable = isPinoPrettyInstalled,
    warn = (message) => process.stderr.write(`[logger] ${message}\n`),
  }: LoggerEnvironment = {},
): Params {
  const usePretty = pretty && !destination && prettyAvailable();
  if (pretty && !destination && !usePretty) {
    warn('LOG_PRETTY=true but pino-pretty is not installed; logging JSON');
  }
  const options: NonNullable<Exclude<Params['pinoHttp'], unknown[]>> = {
    level,
    genReqId: (request: IncomingMessage, response: ServerResponse) => {
      trackRouteTemplate(request);
      return requestId(request, response);
    },
    customProps: (request: IncomingMessage) => {
      const reqId = (request as UserRequest).id;
      return {
        reqId,
        userId: userIdOf(request),
        ...(traceFields().traceId ? {} : { traceId: reqId }),
      };
    },
    autoLogging: { ignore: (request: IncomingMessage) => isProbe(request) },
    mixin: traceFields,
    customLogLevel: (_request: IncomingMessage, response: ServerResponse) =>
      response.statusCode >= 500 ? 'warn' : 'info',
    customSuccessObject: (
      request: IncomingMessage,
      _response: ServerResponse,
      value: object,
    ) => ({ ...value, route: routeOf(request, request.url ?? '') }),
    customErrorObject: (
      request: IncomingMessage,
      _response: ServerResponse,
      _error: Error,
      value: object,
    ) => ({ ...value, route: routeOf(request, request.url ?? '') }),
    customSuccessMessage: () => 'request completed',
    customErrorMessage: () => 'request failed',
    serializers: {
      req: (request: SerializedRequest) => ({
        method: request.method,
        url: sanitizeUrl(request.url ?? ''),
      }),
      res: (response: { statusCode?: number }) => ({
        statusCode: response.statusCode,
      }),
    },
    redact: { paths: REDACT_PATHS, censor: REDACTED },
    ...(usePretty ? { transport: { target: 'pino-pretty' } } : {}),
  };
  return { pinoHttp: destination ? [options, destination] : options };
}
