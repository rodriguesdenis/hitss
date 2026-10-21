import { Client } from 'pg';
import { TeamName } from '../../src/modules/teams/domain/value-objects/team-name';
import { postgresImage, useTestDatabase } from '../support/postgres';

/**
 * TeamName.equals vs the database's `lower(a) = lower(b)`, the expression behind the
 * teams_owner_id_lower_name_key unique index. The index is the authority; equals() is the
 * domain's approximation (fast-path checks, in-memory fake). Every row states both results,
 * so an image, locale or Node upgrade that changes either side fails here.
 */
const AGREE: [string, string, boolean][] = [
  ['Mobile', 'MOBILE', true],
  ['Équipe', 'équipe', true],
  ['Équipe', 'Equipe', false], // accents are significant
  ['ÀÉÎÕÜÇ', 'àéîõüç', true],
  ['ΟΔΟΣ', 'οδοσ', true], // each code point on its own: Σ → σ
  ['ΟΔΟΣ', 'οδος', false], // no final-sigma rule (ς stays distinct)
  ['ΣΊΣΥΦΟΣ', 'σίσυφοσ', true],
  ['İSTANBUL', 'istanbul', true], // U+0130 → plain i (equals maps it explicitly)
  ['ISTANBUL', 'ıstanbul', false], // dotless ı is not i
  ['Straße', 'STRASSE', false], // no full case folding (ß ≠ ss)
  ['🚀 Rocket', '🚀 ROCKET', true],
  ['ǅemal', 'ǆemal', true], // titlecase digraph
  ['Ꭰ Cherokee', 'ꭰ cherokee', true],
  ['Ⰰ Glagolitic', 'ⰰ glagolitic', true],
  ['Ա Armenian', 'ա armenian', true],
];

/**
 * Known divergence on postgres:17-alpine (libc provider, musl): lower() leaves some code points
 * unchanged that JavaScript lowercases, namely the circled letters U+24B6–U+24CF and scripts
 * added in Unicode 14+ (124 code points). For such names equals() says "same" while the index
 * says "different". Effect: only code that compares with equals() (the in-memory fake) treats
 * them as a collision. The Prisma repository's pre-check and the unique index both use
 * lower(), so the database stays authoritative and production behaviour is consistent.
 * Accepted residual (T-002-03).
 */
const DIVERGE: [string, string][] = [
  ['Ⓐ Team', 'ⓐ team'], // U+24B6 circled letter
  ['Ꟑ New', 'ꟑ new'], // U+A7D0, Unicode 14
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
