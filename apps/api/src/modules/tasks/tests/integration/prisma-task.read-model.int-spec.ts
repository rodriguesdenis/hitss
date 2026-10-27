import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import { TaskStatus } from '../../domain/value-objects/task-status.vo';
import { toTaskView } from '../../application/use-cases/task-view';
import { TaskResponseDto } from '../../presentation/dto/task-response.dto';
import { PrismaTaskReadModel } from '../../infrastructure/persistence/task.prisma-read';
import { PrismaTaskRepository } from '../../infrastructure/persistence/task.prisma-repository';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { createTestApp } from '@test/support/app';
import { InMemoryTeamDirectory } from '@test/support/in-memory-team-directory';
import { useTestDatabase } from '@test/support/postgres';
import { aTask } from '@test/support/task-repository.contract';

const LATER = new Date('2026-10-21T11:00:00.000Z');

describe('PrismaTaskReadModel (integration, T-003-06a)', () => {
  const db = useTestDatabase();
  let app: INestApplication;
  let prisma: PrismaService;
  let readModel: PrismaTaskReadModel;
  let repository: PrismaTaskRepository;

  beforeAll(async () => {
    app = await createTestApp(db.url);
    prisma = app.get(PrismaService);
    readModel = new PrismaTaskReadModel(prisma);
    repository = new PrismaTaskRepository(app.get(PrismaService));
  });

  afterAll(async () => {
    await app?.close();
  });

  const newOwner = async (): Promise<string> =>
    (
      await prisma.user.create({
        data: { name: 'Owner', email: `owner-${randomUUID()}@example.test` },
      })
    ).id;

  const newTeam = async (ownerId: string, name: string): Promise<string> => {
    const id = randomUUID();
    const now = new Date('2026-10-21T08:00:00.000Z');
    await prisma.team.create({
      data: {
        id,
        ownerId,
        name,
        colorHex: '#7C3AED',
        createdAt: now,
        updatedAt: now,
      },
    });
    return id;
  };

  it('AC-03.8.1 returns the stored task as a flat record (every field, team ids sorted)', async () => {
    const ownerId = await newOwner();
    const teams = [
      await newTeam(ownerId, 'Mobile'),
      await newTeam(ownerId, 'Backend'),
    ];
    const task = aTask(ownerId, {
      status: TaskStatus.DONE,
      dueDate: '2026-12-31',
      teamIds: teams,
    });
    await repository.insert(task);

    await expect(readModel.findById(ownerId, task.id)).resolves.toEqual({
      id: task.id,
      title: 'Write release notes',
      description: 'For 1.2',
      status: 'DONE',
      dueDate: '2026-12-31',
      completedAt: task.completedAt,
      teamIds: [...teams].sort(),
      version: 1,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    });
  });

  it('returns a task without teams, description or due date', async () => {
    const ownerId = await newOwner();
    const task = aTask(ownerId, { description: null, dueDate: null });
    await repository.insert(task);

    await expect(readModel.findById(ownerId, task.id)).resolves.toMatchObject({
      description: null,
      dueDate: null,
      completedAt: null,
      teamIds: [],
    });
  });

  it('AC-03.8.2 returns null for an unknown, malformed or deleted task id', async () => {
    const ownerId = await newOwner();
    const gone = aTask(ownerId);
    await repository.insert(gone);
    gone.delete(LATER);
    await repository.update(gone);

    await expect(readModel.findById(ownerId, gone.id)).resolves.toBeNull();
    await expect(readModel.findById(ownerId, randomUUID())).resolves.toBeNull();
    await expect(readModel.findById(ownerId, 'not-a-uuid')).resolves.toBeNull();
  });

  it('AC-03.12.1 never returns another owner’s task', async () => {
    const [ownerId, stranger] = [await newOwner(), await newOwner()];
    const task = aTask(ownerId);
    await repository.insert(task);

    await expect(readModel.findById(stranger, task.id)).resolves.toBeNull();
  });

  it('AC-03.2.5 presents the record with live teams by name (record + TeamLookup + today)', async () => {
    const ownerId = await newOwner();
    const [mobile, backend, archived] = [
      await newTeam(ownerId, 'mobile'),
      await newTeam(ownerId, 'Backend'),
      await newTeam(ownerId, 'Archive'),
    ];
    const task = aTask(ownerId, {
      dueDate: '2026-10-20',
      teamIds: [mobile, backend, archived],
    });
    await repository.insert(task);
    const directory = new InMemoryTeamDirectory();
    directory.add(ownerId, { id: mobile, name: 'mobile', colorHex: '#7C3AED' });
    directory.add(ownerId, {
      id: backend,
      name: 'Backend',
      colorHex: '#0EA5E9',
    });
    directory.add(ownerId, {
      id: archived,
      name: 'Archive',
      colorHex: '#F59E0B',
    });
    directory.remove(archived);

    const record = (await readModel.findById(ownerId, task.id))!;
    const view = TaskResponseDto.from(
      toTaskView(
        record,
        await directory.summaries(ownerId, record.teamIds),
        DueDate.create('2026-10-21'),
      ),
    );

    expect(view.teams.map((t) => t.name)).toEqual(['Backend', 'mobile']);
    expect(view.isOverdue).toBe(true);
  });
});
