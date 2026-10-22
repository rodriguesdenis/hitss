import type { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import {
  DEMO_TASK_IDS,
  DEMO_TEAM_IDS,
  DEMO_USER_ID,
  demoTaskFixtures,
} from './fixtures';

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
