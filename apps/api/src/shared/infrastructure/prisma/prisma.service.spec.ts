import type { AppConfig } from '../../../config/app-config';
import { DatabaseUnavailableError } from './database-probe';
import { PrismaService, toLogEventLog, toQueryLog } from './prisma.service';

const EMAIL = 'someone@example.test';
const at = new Date(0);

describe('toQueryLog', () => {
  it('keeps the statement and duration but never the bound parameters', () => {
    const log = toQueryLog({
      timestamp: at,
      query: 'SELECT "id" FROM "users" WHERE "email" = $1',
      params: `["${EMAIL}"]`,
      duration: 3,
      target: 'quaint::connector::metrics',
    });

    expect(log).toEqual({
      msg: 'prisma.query',
      query: 'SELECT "id" FROM "users" WHERE "email" = $1',
      durationMs: 3,
    });
    expect(JSON.stringify(log)).not.toContain(EMAIL);
  });
});

describe('toLogEventLog', () => {
  it('logs a unique violation as SQLSTATE code and constraint name, never the duplicated value', () => {
    const message = [
      '',
      'Invalid `prisma.user.create()` invocation:',
      '',
      'Raw query failed. Code: `23505`. Message: `duplicate key value violates unique constraint "users_email_key"`',
      `DETAIL: Key (email)=(${EMAIL}) already exists.`,
    ].join('\n');

    const log = toLogEventLog('error', {
      timestamp: at,
      target: 'user.create',
      message,
    });

    expect(log).toEqual({
      msg: 'prisma.error',
      target: 'user.create',
      code: '23505',
      constraint: 'users_email_key',
    });
    expect(JSON.stringify(log)).not.toContain(EMAIL);
  });

  it('keeps the Prisma error code and drops a value echoed by the driver', () => {
    const message =
      'Invalid `prisma.task.findUnique()` invocation: P2023 Inconsistent column data: invalid input syntax for type uuid: "not-a-uuid"';

    const log = toLogEventLog('warn', {
      timestamp: at,
      target: 'task.findUnique',
      message,
    });

    expect(log).toEqual({
      msg: 'prisma.warn',
      target: 'task.findUnique',
      code: 'P2023',
    });
    expect(JSON.stringify(log)).not.toContain('not-a-uuid');
  });

  it('logs only the target when the message carries no code', () => {
    const log = toLogEventLog('error', {
      timestamp: at,
      target: '$connect',
      message: `connection to ${EMAIL} refused`,
    });

    expect(log).toEqual({ msg: 'prisma.error', target: '$connect' });
  });
});

describe('PrismaService.onModuleInit', () => {
  const service = () =>
    new PrismaService({
      databaseUrl: 'postgresql://user:pw@localhost:1/db',
    } as AppConfig);

  it('probes the database with SELECT 1 and starts when it answers', async () => {
    const prisma = service();
    jest.spyOn(prisma, '$connect').mockResolvedValue(undefined);
    const query = jest
      .spyOn(prisma, '$queryRaw')
      .mockResolvedValue([{ '?column?': 1 }] as never);

    await expect(prisma.onModuleInit()).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('refuses to start when the probe fails', async () => {
    const prisma = service();
    jest.spyOn(prisma, '$connect').mockResolvedValue(undefined);
    jest
      .spyOn(prisma, '$queryRaw')
      .mockRejectedValue(
        Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }),
      );

    await expect(prisma.onModuleInit()).rejects.toBeInstanceOf(
      DatabaseUnavailableError,
    );
  });
});
