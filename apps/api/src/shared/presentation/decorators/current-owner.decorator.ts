import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Owner } from '../../domain/owner';

export const CurrentOwner = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Owner => {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { id?: unknown } | null }>();
    const id = user?.id;
    if (typeof id !== 'string' || id === '') {
      throw new UnauthorizedException();
    }
    return { ownerId: id };
  },
);
