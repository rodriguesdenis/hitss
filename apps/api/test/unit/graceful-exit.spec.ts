import { GracefulExit } from '../../src/graceful-exit';

describe('GracefulExit', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['SIGTERM', 'SIGINT'])(
    'turns the final %s re-raise into exit code 0',
    (signal) => {
      const once = jest
        .spyOn(process, 'once')
        .mockImplementation((() => process) as never);
      const exit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });

      new GracefulExit().onApplicationShutdown(signal);

      expect(once).toHaveBeenCalledWith(signal, expect.any(Function));
      const listener = once.mock.calls[0]?.[1] as () => void;
      expect(() => listener()).toThrow('exit');
      expect(exit).toHaveBeenCalledWith(0);
    },
  );

  it('does nothing for other shutdowns (app.close() in tests)', () => {
    const once = jest.spyOn(process, 'once');
    new GracefulExit().onApplicationShutdown();
    new GracefulExit().onApplicationShutdown('SIGUSR2');
    expect(once).not.toHaveBeenCalled();
  });
});
