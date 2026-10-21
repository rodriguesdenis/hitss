import { toQueryLog } from './prisma.service';

describe('toQueryLog', () => {
  it('keeps the statement and duration but never the bound parameters', () => {
    const log = toQueryLog({
      timestamp: new Date(0),
      query: 'SELECT "id" FROM "users" WHERE "email" = $1',
      params: '["someone@example.test"]',
      duration: 3,
      target: 'quaint::connector::metrics',
    });

    expect(log).toEqual({
      msg: 'prisma.query',
      query: 'SELECT "id" FROM "users" WHERE "email" = $1',
      durationMs: 3,
    });
    expect(JSON.stringify(log)).not.toContain('someone@example.test');
  });
});
