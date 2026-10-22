import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../../src/config/app-config';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { PrismaTaskRepository } from '../../src/modules/tasks/infrastructure/persistence/task.prisma-repository';
import { aTask } from '../support/task-repository.contract';
import { CALENDAR_EDGES, activeZone } from './zone';

it('PrismaTaskRepository stores and loads calendar days in the process zone', async () => {
  activeZone();
  const databaseUrl = process.env.PROBE_DATABASE_URL;
  if (!databaseUrl) throw new Error('PROBE_DATABASE_URL is required');
  const prisma = new PrismaService({ databaseUrl } as AppConfig);
  try {
    const repository = new PrismaTaskRepository(prisma);
    const owner = await prisma.user.create({
      data: { name: 'Owner', email: `tz-${randomUUID()}@example.test` },
    });

    for (const day of CALENDAR_EDGES) {
      const task = aTask(owner.id, { dueDate: day });
      await repository.insert(task);
      const [row] = await prisma.$queryRaw<{ day: string }[]>`
        SELECT due_date::text AS day FROM tasks WHERE id = ${task.id}::uuid`;
      const loaded = await repository.findById(owner.id, task.id);

      expect(row?.day).toBe(day);
      expect(loaded!.dueDate!.value).toBe(day);
    }
  } finally {
    await prisma.$disconnect();
  }
});
