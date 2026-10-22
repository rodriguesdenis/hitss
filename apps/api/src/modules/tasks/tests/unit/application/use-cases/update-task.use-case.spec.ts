import { InMemoryTaskRepository } from '@test/support/in-memory-task.repository';
import { InMemoryTeamLookup } from '@test/support/in-memory-team-lookup';
import { Clock } from '../../../../../../shared/domain/clock';
import { Task } from '../../../../domain/entities/task.entity';
import {
  TaskNotFound,
  TooManyTeams,
  UnknownTeams,
} from '../../../../domain/errors/task.errors';
import { DueDate } from '../../../../domain/value-objects/due-date.vo';
import { TaskStatus } from '../../../../domain/value-objects/task-status.vo';
import { TaskTitle } from '../../../../domain/value-objects/task-title.vo';
import {
  UpdateTaskInput,
  UpdateTaskUseCase,
} from '../../../../application/use-cases/update-task.use-case';

const OWNER = 'owner-1';
const CREATED = new Date('2026-10-20T13:00:00.000Z');
const NOW = new Date('2026-10-21T09:00:00.000Z');
const team = (n: number) =>
  `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
const [MOBILE, BACKEND, DESIGN] = [team(1), team(2), team(3)];

describe('UpdateTaskUseCase', () => {
  let tasks: InMemoryTaskRepository;
  let directory: InMemoryTeamLookup;
  let useCase: UpdateTaskUseCase;
  let ID: string;

  beforeEach(() => {
    tasks = new InMemoryTaskRepository();
    directory = new InMemoryTeamLookup();
    for (let n = 1; n <= 11; n += 1) {
      directory.add(OWNER, { id: team(n), name: `T${n}`, colorHex: '#7C3AED' });
    }
    const draft = Task.create({
      ownerId: OWNER,
      title: TaskTitle.create('Draft'),
      description: 'v1',
      dueDate: DueDate.create('2026-10-30'),
      status: TaskStatus.PENDING,
      teamIds: [MOBILE, BACKEND],
      now: CREATED,
    });
    tasks.seed(draft);
    ID = draft.id;
    const clock: Clock = { now: () => NOW };
    useCase = new UpdateTaskUseCase(tasks, directory, clock);
  });

  const replace = (
    changes: Partial<Omit<UpdateTaskInput, 'ownerId' | 'id'>> = {},
    ownerId = OWNER,
  ) =>
    useCase.execute({
      ownerId,
      id: ID,
      title: 'Draft',
      status: TaskStatus.PENDING,
      teamIds: [BACKEND, MOBILE],
      description: 'v1',
      dueDate: '2026-10-30',
      ...changes,
    });
  const stored = () => tasks.all()[0];

  it('AC-03.9.1 replaces every editable field in one write: version + 1, updated time now, created time kept', async () => {
    await replace({
      title: 'Final',
      description: 'v2',
      status: TaskStatus.IN_PROGRESS,
      dueDate: '2026-11-02',
      teamIds: [DESIGN],
    });

    const task = stored();
    expect(task?.title.value).toBe('Final');
    expect(task?.description).toBe('v2');
    expect(task?.status).toBe(TaskStatus.IN_PROGRESS);
    expect(task?.dueDate?.value).toBe('2026-11-02');
    expect(task?.teamIds).toEqual([DESIGN]);
    expect(task?.version).toBe(2);
    expect(task?.updatedAt).toEqual(NOW);
    expect(task?.createdAt).toEqual(CREATED);
  });

  it('AC-03.9.2 omitted description and due date are cleared, and an empty team list unassigns all', async () => {
    await replace({ description: undefined, dueDate: undefined, teamIds: [] });

    expect(stored()?.description).toBeNull();
    expect(stored()?.dueDate).toBeNull();
    expect(stored()?.teamIds).toEqual([]);
  });

  it('AC-03.9.4 editing into DONE sets the completion time, out of DONE clears it', async () => {
    await replace({ status: TaskStatus.DONE });
    expect(stored()?.completedAt).toEqual(NOW);

    await replace({ status: TaskStatus.PENDING });
    expect(stored()?.completedAt).toBeNull();
  });

  it('AC-03.9.5 an identical replacement (team order ignored) makes no write and keeps the version', async () => {
    const update = jest.spyOn(tasks, 'update');

    await replace();

    expect(update).not.toHaveBeenCalled();
    expect(stored()?.version).toBe(1);
    expect(stored()?.updatedAt).toEqual(CREATED);
  });

  it('AC-03.9.6 an unknown or foreign task → TaskNotFound, even with too many teams', async () => {
    await expect(
      replace(
        { teamIds: Array.from({ length: 11 }, (_, n) => team(n + 1)) },
        'x',
      ),
    ).rejects.toBeInstanceOf(TaskNotFound);
  });

  it('AC-03.9.3 11 teams → TooManyTeams before team existence; nothing changes', async () => {
    const unknown = Array.from({ length: 11 }, (_, n) => team(100 + n));

    await expect(replace({ teamIds: unknown })).rejects.toBeInstanceOf(
      TooManyTeams,
    );
    expect(stored()?.version).toBe(1);
  });

  it('AC-03.12.3 a team that is not a live team of the owner → UnknownTeams with exactly that id; nothing changes', async () => {
    const never = team(99);

    const error = await replace({ teamIds: [MOBILE, never] }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(UnknownTeams);
    expect((error as UnknownTeams).teamIds).toEqual([never]);
    expect(stored()?.version).toBe(1);
    expect(stored()?.teamIds).toEqual([MOBILE, BACKEND].sort());
  });

  it('AC-03.9.3 a team gone between the check and the write (FK violation) → UnknownTeams with its id, nothing changed', async () => {
    jest.spyOn(directory, 'findMissing').mockResolvedValueOnce([]);
    tasks.simulateMissingTeam(DESIGN);
    directory.remove(DESIGN);

    const error = await replace({ teamIds: [MOBILE, DESIGN] }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(UnknownTeams);
    expect((error as UnknownTeams).teamIds).toEqual([DESIGN]);
    expect(stored()?.version).toBe(1);
  });
});
