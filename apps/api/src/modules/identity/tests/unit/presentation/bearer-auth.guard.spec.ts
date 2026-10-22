import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthService } from '@thallesp/nestjs-better-auth';
import { Public } from '../../../../../shared/presentation/decorators/public.decorator';
import { BearerAuthGuard } from '../../../presentation/bearer-auth.guard';

const SESSION = { session: { id: 's1', token: 'tok' }, user: { id: 'user-1' } };

class Routes {
  private() {}
  @Public() open() {}
}

const handler = (name: 'private' | 'open') =>
  Object.getOwnPropertyDescriptor(Routes.prototype, name)?.value as () => void;

describe('BearerAuthGuard', () => {
  const getSession = jest.fn();
  const guard = new BearerAuthGuard(new Reflector(), {
    api: { getSession },
  } as unknown as AuthService);

  beforeEach(() => getSession.mockReset());

  const run = (
    headers: Record<string, string>,
    route: 'private' | 'open' = 'private',
  ) => {
    const request: {
      headers: Record<string, string>;
      session?: unknown;
      user?: unknown;
    } = {
      headers,
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler(route),
      getClass: () => Routes,
    } as unknown as ExecutionContext;
    return { request, result: guard.canActivate(context) };
  };

  it('AC-08.2 AC-01.2.4 a valid bearer token authenticates; only the Authorization header reaches Better Auth', async () => {
    getSession.mockResolvedValue(SESSION);

    const { request, result } = run({
      authorization: 'Bearer tok.sig',
      cookie: 'better-auth.session_token=other.sig',
    });

    await expect(result).resolves.toBe(true);
    const [{ headers }] = getSession.mock.calls[0] as [{ headers: Headers }];
    expect([...headers.keys()]).toEqual(['authorization']);
    expect(headers.get('authorization')).toBe('Bearer tok.sig');
    expect(request.user).toEqual({ id: 'user-1' });
    expect(request.session).toBe(SESSION);
  });

  it('AC-08.2 a session cookie alone → 401, without asking Better Auth', async () => {
    const { result } = run({ cookie: 'better-auth.session_token=tok.sig' });

    await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getSession).not.toHaveBeenCalled();
  });

  it.each(['Basic dXNlcjpwYXNz', 'tok.sig', '', 'Bearer'])(
    'AC-01.5.2 an Authorization header %j that is not a bearer token → 401',
    async (authorization) => {
      await expect(run({ authorization }).result).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(getSession).not.toHaveBeenCalled();
    },
  );

  it('AC-01.5.2 a bearer token Better Auth does not accept (forged, unsigned, revoked, expired) → 401', async () => {
    getSession.mockResolvedValue(null);

    await expect(
      run({ authorization: 'Bearer forged' }).result,
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('AC-01.5.3 a public route passes without credentials, and still learns the user when a token is sent', async () => {
    const anonymous = run({}, 'open');
    await expect(anonymous.result).resolves.toBe(true);
    expect(anonymous.request.user).toBeNull();

    getSession.mockResolvedValue(SESSION);
    const signedIn = run({ authorization: 'Bearer tok.sig' }, 'open');
    await expect(signedIn.result).resolves.toBe(true);
    expect(signedIn.request.user).toEqual({ id: 'user-1' });
  });
});
