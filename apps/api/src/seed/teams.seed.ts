import type { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import { DEMO_USER_ID, demoTeamFixtures } from './fixtures';

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
