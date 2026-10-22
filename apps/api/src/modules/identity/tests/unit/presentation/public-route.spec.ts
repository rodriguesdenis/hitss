import { Reflector } from '@nestjs/core';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import {
  Public,
  PUBLIC_ROUTE,
} from '../../../../../shared/presentation/decorators/public.decorator';

describe('@Public() and the Better Auth guard', () => {
  it('sets the same metadata the Better Auth guard reads (@AllowAnonymous)', () => {
    class Routes {
      @Public() mine() {}
      @AllowAnonymous() theirs() {}
    }
    const reflector = new Reflector();
    const read = (name: 'mine' | 'theirs') =>
      reflector.get<unknown>(
        PUBLIC_ROUTE,
        Object.getOwnPropertyDescriptor(Routes.prototype, name)
          ?.value as () => void,
      );

    expect(read('mine')).toBe(true);
    expect(read('theirs')).toBe(true);
  });
});
