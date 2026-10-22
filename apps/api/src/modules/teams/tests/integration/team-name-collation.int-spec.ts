import { Client } from 'pg';
import { TeamName } from '../../domain/value-objects/team-name.vo';
import { postgresImage, useTestDatabase } from '@test/support/postgres';

const AGREE: [string, string, boolean][] = [
  ['Mobile', 'MOBILE', true],
  ['Équipe', 'équipe', true],
  ['Équipe', 'Equipe', false],
  ['ÀÉÎÕÜÇ', 'àéîõüç', true],
  ['ΟΔΟΣ', 'οδοσ', true],
  ['ΟΔΟΣ', 'οδος', false],
  ['ΣΊΣΥΦΟΣ', 'σίσυφοσ', true],
  ['İSTANBUL', 'istanbul', true],
  ['ISTANBUL', 'ıstanbul', false],
  ['Straße', 'STRASSE', false],
  ['🚀 Rocket', '🚀 ROCKET', true],
  ['ǅemal', 'ǆemal', true],
  ['Ꭰ Cherokee', 'ꭰ cherokee', true],
  ['Ⰰ Glagolitic', 'ⰰ glagolitic', true],
  ['Ա Armenian', 'ա armenian', true],
];

const DIVERGE: [string, string][] = [
  ['Ⓐ Team', 'ⓐ team'],
  ['Ꟑ New', 'ꟑ new'],
];

describe('TeamName.equals vs PostgreSQL lower() (integration, T-002-03)', () => {
  const db = useTestDatabase();
  let sql: Client;

  beforeAll(async () => {
    sql = new Client({ connectionString: db.url });
    await sql.connect();
  });

  afterAll(async () => {
    await sql?.end();
  });

  const dbEquals = async (a: string, b: string): Promise<boolean> => {
    const { rows } = await sql.query<{ eq: boolean }>(
      'SELECT lower($1) = lower($2) AS eq',
      [a, b],
    );
    return rows[0]!.eq;
  };

  const domainEquals = (a: string, b: string) =>
    TeamName.create(a).equals(TeamName.create(b));

  it(`runs on the compose image (${postgresImage()}) with the libc provider`, async () => {
    const { rows } = await sql.query<{ provider: string }>(
      'SELECT datlocprovider AS provider FROM pg_database WHERE datname = current_database()',
    );

    expect(rows[0]!.provider).toBe('c');
  });

  it.each(AGREE)('%s vs %s: both say same=%s', async (a, b, same) => {
    expect(await dbEquals(a, b)).toBe(same);
    expect(domainEquals(a, b)).toBe(same);
  });

  it.each(DIVERGE)(
    '%s vs %s: known divergence (domain same, database different)',
    async (a, b) => {
      expect(domainEquals(a, b)).toBe(true);
      expect(await dbEquals(a, b)).toBe(false);
    },
  );
});
