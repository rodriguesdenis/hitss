import type { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import {
  DEMO_TASK_IDS,
  DEMO_TEAM_IDS,
  DEMO_USER_ID,
  demoTaskFixtures,
} from './fixtures';

/**
 * Upserts the 10 demo tasks by their fixed ids with their full seeded values, and rewrites the team
 * links of exactly those tasks. Tasks and links the evaluator created are never touched
 * (AC-07.2.4). Due dates are relative to `seedDay`.
 */
export async function seedTasks(
  prisma: Pick<PrismaService, 'task' | 'team' | 'taskTeam' | '$transaction'>,
  seedDay: Date,
): Promise<number> {
  const fixtures = demoTaskFixtures(seedDay);
  for (const task of fixtures) {
    const values = {
      ownerId: DEMO_USER_ID,
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate ? new Date(`${task.dueDate}T00:00:00.000Z`) : null,
      completedAt: task.completedAt,
      version: 1,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      deletedAt: null,
    };
    await prisma.task.upsert({
      where: { id: task.id },
      create: { id: task.id, ...values },
      update: values,
    });
  }
  // A seeded team that could not be restored may not exist at all: link only existing teams.
  const existingTeams = new Set(
    (
      await prisma.team.findMany({
        where: { id: { in: DEMO_TEAM_IDS } },
        select: { id: true },
      })
    ).map((team) => team.id),
  );
  await prisma.$transaction([
    prisma.taskTeam.deleteMany({ where: { taskId: { in: DEMO_TASK_IDS } } }),
    prisma.taskTeam.createMany({
      data: fixtures.flatMap((task) =>
        task.teamIds
          .filter((id) => existingTeams.has(id))
          .map((teamId) => ({
            taskId: task.id,
            teamId,
            createdAt: task.createdAt,
          })),
      ),
    }),
  ]);
  return fixtures.length;
}
