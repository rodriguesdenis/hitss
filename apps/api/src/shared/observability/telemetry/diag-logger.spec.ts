import { createDedupDiagLogger } from './diag-logger';

describe('diag logger bridge', () => {
  let now: number;
  const warn = jest.fn<void, [string]>();
  const logger = () => createDedupDiagLogger({ warn, now: () => now });

  beforeEach(() => {
    now = 0;
    warn.mockReset();
  });

  it('AC-06.5.2 emits at most one export warning per 60 seconds', () => {
    const diag = logger();
    for (let i = 0; i < 50; i++) diag.error('export failed', new Error('x'));
    expect(warn).toHaveBeenCalledTimes(1);

    now = 59_999;
    diag.error('export failed again');
    expect(warn).toHaveBeenCalledTimes(1);

    now = 60_000;
    diag.error('export failed once more');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('AC-06.5.2 reports how many were suppressed in the next window', () => {
    const diag = logger();
    diag.error('a');
    diag.error('b');
    diag.warn('c');
    now = 61_000;
    diag.error('d');
    expect(warn.mock.calls[1]?.[0]).toContain('2 similar');
  });

  it('AC-06.5.5 never prints error details that could carry credentials', () => {
    const diag = logger();
    diag.error('export failed', new Error('Bearer token-value'));
    expect(warn.mock.calls[0]?.[0]).not.toContain('token-value');
  });

  it('ignores debug, info and verbose chatter', () => {
    const diag = logger();
    diag.debug('x');
    diag.info('x');
    diag.verbose('x');
    expect(warn).not.toHaveBeenCalled();
  });
});
