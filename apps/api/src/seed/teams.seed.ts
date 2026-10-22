import type { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import { DEMO_USER_ID, demoTeamFixtures } from './fixtures';

/**
 * Upserts the 3 demo teams by their fixed ids with their full seeded values: re-seeding restores a
 * renamed or deleted seeded team and leaves every other team untouched (AC-07.2.4).
 */
export async function seedTeams(
  prisma: Pick<PrismaService, 'team'>,
): Promise<number> {
  const fixtures = demoTeamFixtures();
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
    await prisma.team.upsert({
      where: { id: team.id },
      create: { id: team.id, ...values },
      update: values,
    });
  }
  return fixtures.length;
}
