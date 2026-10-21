import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '../support/app';
import { useTestDatabase } from '../support/postgres';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface Column {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
}

describe('Identity schema (integration, T-001-05)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp(db.url);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  const columns = () =>
    prisma.$queryRaw<Column[]>`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'sessions', 'accounts', 'verifications')`;

  const column = (all: Column[], table: string, name: string) =>
    all.find((c) => c.table_name === table && c.column_name === name);

  it('creates the Better Auth tables with snake_case names', async () => {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
      ORDER BY table_name`;

    expect(tables.map((t) => t.table_name)).toEqual([
      'accounts',
      'sessions',
      'users',
      'verifications',
    ]);
    const all = await columns();
    expect(column(all, 'users', 'email_verified')).toBeDefined();
    expect(column(all, 'sessions', 'expires_at')).toBeDefined();
    expect(column(all, 'accounts', 'provider_id')).toBeDefined();
    expect(all.some((c) => /[A-Z]/.test(c.column_name))).toBe(false);
  });

  it('keeps every id and user_id as text (D16) and every timestamp with time zone', async () => {
    const all = await columns();
    const ids = all.filter(
      (c) => c.column_name === 'id' || c.column_name === 'user_id',
    );
    const times = all.filter((c) => /_at$/.test(c.column_name));

    expect(ids).toHaveLength(6);
    expect(new Set(ids.map((c) => c.data_type))).toEqual(new Set(['text']));
    expect(times.length).toBeGreaterThan(0);
    expect(new Set(times.map((c) => c.data_type))).toEqual(
      new Set(['timestamp with time zone']),
    );
  });

  it('generates UUID ids in the database when Better Auth omits them', async () => {
    const user = await prisma.user.create({
      data: { name: 'Ada', email: 'ada@example.test' },
    });

    expect(user.id).toMatch(UUID);
    expect(user.emailVerified).toBe(false);
  });

  it('rejects a second user with the same email', async () => {
    await prisma.user.create({
      data: { name: 'Bob', email: 'bob@example.test' },
    });

    await expect(
      prisma.user.create({
        data: { name: 'Bob 2', email: 'bob@example.test' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects a second session with the same token', async () => {
    const user = await prisma.user.create({
      data: { name: 'Cy', email: 'cy@example.test' },
    });
    const session = {
      userId: user.id,
      token: 'session-token-fixture',
      expiresAt: new Date(Date.now() + 60_000),
    };
    await prisma.session.create({ data: session });

    await expect(
      prisma.session.create({ data: session }),
    ).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('deletes sessions and accounts with their user (ON DELETE CASCADE)', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Dee',
        email: 'dee@example.test',
        sessions: {
          create: {
            token: 'dee-token',
            expiresAt: new Date(Date.now() + 60_000),
          },
        },
        accounts: { create: { providerId: 'credential', accountId: 'dee' } },
      },
    });

    await prisma.user.delete({ where: { id: user.id } });

    await expect(
      prisma.session.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.account.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);
  });

  it('declares the constraints and indexes the plan requires', async () => {
    const indexes = await prisma.$queryRaw<
      { indexname: string; indexdef: string }[]
    >`
      SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`;
    const fks = await prisma.$queryRaw<{ name: string; definition: string }[]>`
      SELECT conname AS name, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace`;
    const def = (name: string) =>
      indexes.find((i) => i.indexname === name)?.indexdef;

    expect(def('users_email_key')).toMatch(/UNIQUE INDEX .* \(email\)/);
    expect(def('sessions_token_key')).toMatch(/UNIQUE INDEX .* \(token\)/);
    expect(def('sessions_user_id_idx')).toMatch(/\(user_id\)/);
    expect(def('accounts_user_id_idx')).toMatch(/\(user_id\)/);
    expect(def('verifications_identifier_idx')).toMatch(/\(identifier\)/);
    expect(fks.map((fk) => fk.name).sort()).toEqual([
      'accounts_user_id_fkey',
      'sessions_user_id_fkey',
    ]);
    for (const fk of fks) {
      expect(fk.definition).toMatch(/REFERENCES users\(id\)/);
      expect(fk.definition).toMatch(/ON DELETE CASCADE/);
    }
  });
});
