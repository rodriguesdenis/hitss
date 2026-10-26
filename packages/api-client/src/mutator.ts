export type TokenGetter = () =>
  string | null | undefined | Promise<string | null | undefined>;

export type ApiClientConfig = {
  baseUrl: string;
  getToken: TokenGetter;
  timeoutMs?: number;
};

export const DEFAULT_TIMEOUT_MS = 15_000;

const RETRY_AFTER_MIN_SECONDS = 1;
const RETRY_AFTER_MAX_SECONDS = 60;

export class ApiError<TBody = unknown> extends Error {
  readonly status: number;
  readonly body: TBody;
  readonly retryAfter: number | undefined;

  constructor(status: number, body: TBody, retryAfter?: number) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}

export class ApiTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`API request timed out after ${timeoutMs} ms`);
    this.name = 'TimeoutError';
  }
}

export class ApiNetworkError extends TypeError {
  constructor(cause: unknown) {
    super('API request could not reach the server', { cause });
    this.name = 'NetworkError';
  }
}

export type ErrorType<TBody> = ApiError<TBody>;

export type BodyType<TBody> = TBody;

let config: ApiClientConfig | undefined;
let requestCount = 0;

export function configureApiClient(next: ApiClientConfig): void {
  config = next;
}

function resolveUrl(baseUrl: string, url: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  if (url.startsWith('/') && !url.startsWith('//')) {
    return `${base}${url}`;
  }
  if (url === base || url.startsWith(`${base}/`)) {
    return url;
  }
  throw new Error(
    `@hitss/api-client: refusing ${url}: it is outside the configured baseUrl`,
  );
}

function requestId(): string {
  requestCount = (requestCount + 1) % 1_679_616;
  return [
    Date.now().toString(36),
    requestCount.toString(36),
    Math.random().toString(36).slice(2, 10),
  ].join('-');
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) {
    return undefined;
  }
  const seconds = /^\d+$/.test(header.trim())
    ? Number(header.trim())
    : (Date.parse(header) - Date.now()) / 1000;
  if (Number.isNaN(seconds)) {
    return undefined;
  }
  return Math.min(
    RETRY_AFTER_MAX_SECONDS,
    Math.max(RETRY_AFTER_MIN_SECONDS, Math.round(seconds)),
  );
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  return response.headers.get('content-type')?.includes('json')
    ? JSON.parse(text)
    : text;
}

export async function apiFetch<T>(url: string, init: RequestInit): Promise<T> {
  if (!config) {
    throw new Error(
      '@hitss/api-client: call configureApiClient before the first request',
    );
  }
  const target = resolveUrl(config.baseUrl, url);
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const caller = init.signal;
  const forwardAbort = () => controller.abort();
  if (caller?.aborted) {
    controller.abort();
  } else {
    caller?.addEventListener('abort', forwardAbort);
  }
  try {
    const headers = new Headers(init.headers);
    const token = await config.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('X-Request-Id')) {
      headers.set('X-Request-Id', requestId());
    }
    let response: Response;
    try {
      response = await fetch(target, {
        ...init,
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw error;
      }
      throw new ApiNetworkError(error);
    }
    const body = await readBody(response);
    if (!response.ok) {
      throw new ApiError(
        response.status,
        body,
        parseRetryAfter(response.headers.get('Retry-After')),
      );
    }
    return body as T;
  } catch (error) {
    if (timedOut) {
      throw new ApiTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener('abort', forwardAbort);
  }
}
