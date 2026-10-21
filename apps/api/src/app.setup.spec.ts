import { INestApplication } from '@nestjs/common';
import { setupApp } from './app.setup';

describe('setupApp', () => {
  it('enables shutdown hooks so SIGTERM closes the app and its database pool', () => {
    const enableShutdownHooks = jest.fn();
    const app = { enableShutdownHooks } as unknown as INestApplication;

    expect(setupApp(app)).toBe(app);
    expect(enableShutdownHooks).toHaveBeenCalledTimes(1);
  });
});
