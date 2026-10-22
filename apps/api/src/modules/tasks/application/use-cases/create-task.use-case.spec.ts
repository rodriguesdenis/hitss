import { InMemoryTaskRepository } from '../../../../../test/support/in-memory-task.repository';
import { InMemoryTeamLookup } from '../../../../../test/support/in-memory-team-lookup';
import { Clock } from '../../../../shared/domain/clock';
import {
  InvalidTaskTitle,
  TooManyTeams,
  UnknownTeams,
} from '../../domain/errors/task.errors';
import { TaskStatus } from '../../domain/value-objects/task-status.vo';
import { CreateTaskInput, CreateTaskUseCase } from './create-task.use-case';

const OWNER = 'owner-1';
const NOW = new Date('2026-10-20T13:00:00.000Z');
const team = (n: number) =>
  `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;

describe('CreateTaskUseCase', () => {
  let tasks: InMemoryTaskRepository;
  let directory: InMemoryTeamLookup;
  let useCase: CreateTaskUseCase;

  beforeEach(() => {
    tasks = new InMemoryTaskRepository();
    directory = new InMemoryTeamLookup();
    for (let n = 1; n <= 11; n += 1) {
      directory.add(OWNER, { id: team(n), name: `T${n}`, colorHex: '#7C3AED' });
    }
    const clock: Clock = { now: () => NOW };
    useCase = new CreateTaskUseCase(tasks, directory, clock);
  });

  const create = (overrides: Partial<CreateTaskInput> = {}) =>
    useCase.execute({
      ownerId: OWNER,
      title: 'Write release notes',
      ...overrides,
    });

  it('AC-03.1.1 inserts a pending task at version 1 for the owner and returns its new id', async () => {
    const id = await create();

    const [task] = tasks.all();
    expect(task?.id).toBe(id);
    expect(task?.ownerId).toBe(OWNER);
    expect(task?.status).toBe(TaskStatus.PENDING);
    expect(task?.version).toBe(1);
  });

  it('AC-03.1.4 a task created as DONE has its completion time set to now', async () => {
    await create({ status: TaskStatus.DONE });

    expect(tasks.all()[0]?.completedAt).toEqual(NOW);
  });

  it('AC-03.1.6 assigns live teams of the owner', async () => {
    await create({ teamIds: [team(2), team(1)] });

    expect(tasks.all()[0]?.teamIds.values).toEqual([team(1), team(2)]);
  });

  it('AC-03.1.6 TOO_MANY_TEAMS is checked before team existence, and nothing is written', async () => {
    const unknown = Array.from({ length: 11 }, (_, n) => team(100 + n));

    await expect(create({ teamIds: unknown })).rejects.toBeInstanceOf(
      TooManyTeams,
    );
    expect(tasks.all()).toEqual([]);
  });

  it('AC-03.12.3 UNKNOWN_TEAMS lists exactly the ids that are not live teams of the owner, and nothing is written', async () => {
    const gone = team(3);
    directory.remove(gone);
    const never = team(99);

    const error = await create({ teamIds: [team(1), never, gone] }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(UnknownTeams);
    expect([...(error as UnknownTeams).teamIds].sort()).toEqual(
      [gone, never].sort(),
    );
    expect(tasks.all()).toEqual([]);
  });

  it('re-validates the title in the domain (defensive)', async () => {
    await expect(create({ title: 'ab' })).rejects.toBeInstanceOf(
      InvalidTaskTitle,
    );
    expect(tasks.all()).toEqual([]);
  });

  it('AC-03.1.6 a team gone between the check and the insert (FK violation) → UnknownTeams with its id, nothing written', async () => {
    // The directory still sees the team at the check, then it is gone for good.
    jest.spyOn(directory, 'findMissing').mockResolvedValueOnce([]);
    tasks.simulateMissingTeam(team(2));
    directory.remove(team(2));

    const error = await create({ teamIds: [team(1), team(2)] }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(UnknownTeams);
    expect((error as UnknownTeams).teamIds).toEqual([team(2)]);
    expect(tasks.all()).toEqual([]);
  });

  it('any other insert error, or an UnknownTeams that already names ids, passes through without asking again', async () => {
    const boom = new Error('boom');
    const precise = new UnknownTeams([team(9)]);
    const insert = jest.spyOn(tasks, 'insert');
    const findMissing = jest.spyOn(directory, 'findMissing');

    insert.mockRejectedValueOnce(boom);
    await expect(create({ teamIds: [team(1)] })).rejects.toBe(boom);
    insert.mockRejectedValueOnce(precise);
    await expect(create({ teamIds: [team(1)] })).rejects.toBe(precise);
    // Only the two pre-write checks asked the directory.
    expect(findMissing).toHaveBeenCalledTimes(2);
  });

  it('a link failure the directory cannot explain any more keeps the original error', async () => {
    const vague = new UnknownTeams([]);
    jest.spyOn(tasks, 'insert').mockRejectedValueOnce(vague);

    await expect(create({ teamIds: [team(1)] })).rejects.toBe(vague);
  });
});
