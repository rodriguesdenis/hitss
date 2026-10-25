export type TokenGetter = () =>
  string | null | undefined | Promise<string | null | undefined>;

export type ApiClientConfig = {
  baseUrl: string;
  getToken: TokenGetter;
};

export class ApiError<TBody = unknown> extends Error {
  readonly status: number;
  readonly body: TBody;

  constructor(status: number, body: TBody) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export type ErrorType<TBody> = ApiError<TBody>;

export type BodyType<TBody> = TBody;

let config: ApiClientConfig | undefined;

export function configureApiClient(next: ApiClientConfig): void {
  config = next;
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
  const headers = new Headers(init.headers);
  const token = await config.getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${config.baseUrl}${url}`, { ...init, headers });
  const body = await readBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, body);
  }
  return body as T;
}
