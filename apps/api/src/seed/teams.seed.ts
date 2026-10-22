import type { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import { DEMO_USER_ID, demoTeamFixtures } from './fixtures';

/**
 * Upserts the 3 demo teams by their fixed ids with their full seeded values: re-seeding restores a
 * renamed or deleted seeded team and leaves every other team untouched (AC-07.2.4). When the
 * evaluator already owns a team with the seeded name (unique per owner, case-insensitive), that
 * seeded team is not restored: the seed must never stop the API from booting.
 */
export async function seedTeams(
  prisma: Pick<PrismaService, 'team'>,
): Promise<{ restored: number; skipped: number }> {
  const fixtures = demoTeamFixtures();
  let restored = 0;
  let skipped = 0;
  for (const team of fixtures) {
    const values = {
      ownerId: DEMO_USER_ID,
      name: team.name,
      colorHex: team.colorHex,
      description: team.description,
      version: 1,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      deletedAt: null,
    };
    try {
      await prisma.team.upsert({
        where: { id: team.id },
        create: { id: team.id, ...values },
        update: values,
      });
      restored += 1;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      skipped += 1;
    }
  }
  return { restored, skipped };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
