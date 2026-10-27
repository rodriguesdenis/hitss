import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import {
  LocationInterceptor,
  locationOf,
} from '../../../../../src/shared/presentation/interceptors/location.interceptor';

const ID = '0d8f6a52-6c1e-4b8a-9f3e-5a7c2e1d4b90';

function run(originalUrl: string, value: unknown) {
  const setHeader = jest.fn();
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl, url: '/ignored' }),
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of(value) };
  const result = lastValueFrom(
    new LocationInterceptor().intercept(context, next),
  );
  return { result, setHeader };
}

describe('LocationInterceptor', () => {
  it.each([
    ['/api/v1/tasks', `/api/v1/tasks/${ID}`],
    ['/api/v1/teams', `/api/v1/teams/${ID}`],
    ['/api/v1/tasks?x=1&y=2', `/api/v1/tasks/${ID}`],
    ['/api/v1/teams/', `/api/v1/teams/${ID}`],
  ])(
    'AC-10.7 a create on %s sets Location %s from the path and the response id',
    async (url, location) => {
      const { result, setHeader } = run(url, { id: ID, name: 'Mobile' });

      await expect(result).resolves.toEqual({ id: ID, name: 'Mobile' });
      expect(setHeader).toHaveBeenCalledWith('Location', location);
    },
  );

  it.each([[undefined], [null], [{}], [{ id: 7 }]])(
    'AC-10.7 sets no Location when the response %j has no string id',
    async (value) => {
      const { result, setHeader } = run('/api/v1/tasks', value);

      await expect(result).resolves.toEqual(value);
      expect(setHeader).not.toHaveBeenCalled();
    },
  );

  it('falls back to url when there is no originalUrl', () => {
    expect(locationOf({ url: '/api/v1/tasks?a=b' }, ID)).toBe(
      `/api/v1/tasks/${ID}`,
    );
  });
});
