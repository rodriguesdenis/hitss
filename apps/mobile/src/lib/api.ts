import { configureApiClient, type TokenGetter } from '@hitss/api-client';

import { env } from './env';

export function setupApiClient(getToken: TokenGetter): void {
  configureApiClient({ baseUrl: env.apiUrl, getToken });
}
