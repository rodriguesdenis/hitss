import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { RawResponse } from '../../../../../src/shared/presentation/decorators/raw-response.decorator';
import { EnvelopeInterceptor } from '../../../../../src/shared/presentation/interceptors/envelope.interceptor';

class PlainController {
  handler(this: void) {}
}

@RawResponse()
class RawController {
  handler(this: void) {}
}

class MixedController {
  @RawResponse()
  raw(this: void) {}
}

function intercept(
  value: unknown,
  target: { controller: object; handler: () => void } = {
    controller: PlainController,
    handler: PlainController.prototype.handler,
  },
  type = 'http',
): Promise<unknown> {
  const context = {
    getType: () => type,
    getHandler: () => target.handler,
    getClass: () => target.controller,
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of(value) };
  return lastValueFrom(
    new EnvelopeInterceptor(new Reflector()).intercept(context, next),
  );
}

describe('EnvelopeInterceptor', () => {
  it.each([
    [{ id: 't-1' }, { data: { id: 't-1' } }],
    [[{ id: 't-1' }], { data: [{ id: 't-1' }] }],
    [null, { data: null }],
    ['text', { data: 'text' }],
    [{ data: 1, other: 2 }, { data: { data: 1, other: 2 } }],
  ])('wraps %j as { data }', async (value, expected) => {
    expect(await intercept(value)).toEqual(expected);
  });

  it.each([
    {
      data: [{ id: 't-1' }],
      meta: { total: 1, limit: 20, offset: 0, hasNextPage: false },
    },
    { data: { id: 't-1' } },
  ])('passes an existing envelope %j through', async (envelope) => {
    expect(await intercept(envelope)).toBe(envelope);
  });

  it('leaves an empty result empty (204 No Content)', async () => {
    expect(await intercept(undefined)).toBeUndefined();
  });

  it('@RawResponse() on a controller skips wrapping', async () => {
    const value = { status: 'ok' };

    expect(
      await intercept(value, {
        controller: RawController,
        handler: RawController.prototype.handler,
      }),
    ).toBe(value);
  });

  it('@RawResponse() on a handler skips wrapping', async () => {
    const value = { status: 'ok' };

    expect(
      await intercept(value, {
        controller: MixedController,
        handler: MixedController.prototype.raw,
      }),
    ).toBe(value);
  });

  it('streamed files and non-HTTP contexts are untouched', async () => {
    const file = new StreamableFile(Buffer.from('x'));

    expect(await intercept(file)).toBe(file);
    expect(await intercept({ id: 1 }, undefined, 'rpc')).toEqual({ id: 1 });
  });
});
