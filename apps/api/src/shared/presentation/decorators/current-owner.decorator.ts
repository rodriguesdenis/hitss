import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Owner } from '../../domain/owner';

/**
 * The authenticated caller as an `Owner` (decision CO-1: shared, with no Better Auth types, so
 * teams and tasks never import modules/identity). The global auth guard has already put the user
 * on the request; reading it structurally keeps this layer independent of the auth library.
 */
export const CurrentOwner = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Owner => {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { id?: unknown } | null }>();
    const id = user?.id;
    if (typeof id !== 'string' || id === '') {
      // Defensive: only reachable if a route is public by mistake.
      throw new UnauthorizedException();
    }
    return { ownerId: id };
  },
);
