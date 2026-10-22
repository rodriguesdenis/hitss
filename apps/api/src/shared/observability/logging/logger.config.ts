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

/** Seams for tests; defaults probe the installed packages and write to stderr. */
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

/** Opaque user id only; never email or name (AC-06.3.6). */
function userIdOf(request: UserRequest): string | undefined {
  const id = request.user?.id;
  return typeof id === 'string' ? id : undefined;
}

/**
 * nestjs-pino options: one completion line per non-probe request, correlated with the active
 * trace, with headers and bodies left out and S-M8 redaction as defence in depth.
 * `destination` is for tests; production writes JSON to stdout.
 */
export function createLoggerParams(
  { level, pretty }: LoggerSettings,
  destination?: DestinationStream,
  {
    prettyAvailable = isPinoPrettyInstalled,
    warn = (message) => process.stderr.write(`[logger] ${message}\n`),
  }: LoggerEnvironment = {},
): Params {
  // pino-pretty is a dev dependency: the production image does not have it. Fall back to JSON
  // with one warning instead of crashing on a missing transport.
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
        // Without telemetry there is no trace: the request id stands in as the trace id, as in
        // the error envelope (AC-08.7). With a span the mixin below supplies the real one.
        ...(traceFields().traceId ? {} : { traceId: reqId }),
      };
    },
    autoLogging: { ignore: (request: IncomingMessage) => isProbe(request) },
    mixin: traceFields,
    // 5xx stay at warn here: the exception filter writes the single error-level entry (AC-06.3.4).
    customLogLevel: (_request: IncomingMessage, response: ServerResponse) =>
      response.statusCode >= 500 ? 'warn' : 'info',
    // The route template is known only once the response is written (ids and search terms stay out).
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
      // Bound when the request starts, before routing: path without query only.
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
