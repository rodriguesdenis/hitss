import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentOwner } from './current-owner.decorator';

/** Runs the factory behind a param decorator, as Nest does for a handler argument. */
function resolve(user: unknown) {
  class Probe {
    handler(@CurrentOwner() owner: unknown) {
      return owner;
    }
  }
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    Probe,
    'handler',
  ) as Record<
    string,
    { factory: (data: unknown, ctx: ExecutionContext) => unknown }
  >;
  const [{ factory }] = Object.values(metadata) as [
    { factory: (data: unknown, ctx: ExecutionContext) => unknown },
  ];
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return factory(undefined, ctx);
}

describe('@CurrentOwner()', () => {
  it('maps the authenticated user to a framework-free Owner { ownerId }', () => {
    expect(
      resolve({ id: 'user-1', email: 'marina@example.test', name: 'Marina' }),
    ).toEqual({
      ownerId: 'user-1',
    });
  });

  it.each([null, undefined, {}, { id: '' }, { id: 42 }])(
    'throws 401 when there is no usable user (%j): defensive, the guard already ran',
    (user) => {
      expect(() => resolve(user)).toThrow(UnauthorizedException);
    },
  );
});
