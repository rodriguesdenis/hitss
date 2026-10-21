import { INestApplication } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { setupApp } from './app.setup';

describe('setupApp', () => {
  const logger = {};
  const enableShutdownHooks = jest.fn();
  const useLogger = jest.fn();
  const get = jest.fn().mockReturnValue(logger);
  const app = {
    enableShutdownHooks,
    useLogger,
    get,
  } as unknown as INestApplication;

  it('enables shutdown hooks so SIGTERM closes the app and its database pool', () => {
    expect(setupApp(app)).toBe(app);
    expect(enableShutdownHooks).toHaveBeenCalledTimes(1);
  });

  it('AC-06.3.5 routes Nest logs through the pino logger', () => {
    setupApp(app);
    expect(get).toHaveBeenCalledWith(Logger);
    expect(useLogger).toHaveBeenCalledWith(logger);
  });
});
