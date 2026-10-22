import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { EtagInterceptor } from './etag.interceptor';

const run = async (value: unknown) => {
  const setHeader = jest.fn();
  const context = {
    switchToHttp: () => ({ getResponse: () => ({ setHeader }) }),
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of(value) };
  const result = await lastValueFrom(
    new EtagInterceptor().intercept(context, next),
  );
  return { result, setHeader };
};

describe('EtagInterceptor', () => {
  it('AC-02.5.1 sets a weak ETag from the version of the returned resource, unchanged body', async () => {
    const team = { id: 't', version: 4 };
    const { result, setHeader } = await run(team);

    expect(setHeader).toHaveBeenCalledWith('ETag', 'W/"4"');
    expect(result).toBe(team);
  });

  it.each([
    ['no version', { id: 't' }],
    ['a non-integer version', { version: '4' }],
    ['a zero version', { version: 0 }],
    ['a list', [{ version: 1 }]],
    ['nothing', undefined],
  ])('sets no ETag for %s', async (_label, value) => {
    const { setHeader } = await run(value);

    expect(setHeader).not.toHaveBeenCalled();
  });
});
