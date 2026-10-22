import { InMemoryTaskRepository } from '../../../../../test/support/in-memory-task.repository';
import { TeamDeleted } from '../../../teams/contracts/team-deleted.event';
import { Task } from '../../domain/entities/task.entity';
import { TaskDescription } from '../../domain/value-objects/task-description.vo';
import { TaskTeamIds } from '../../domain/value-objects/task-team-ids.vo';
import { TaskTitle } from '../../domain/value-objects/task-title.vo';
import { OnTeamDeletedHandler } from './on-team-deleted.handler';

const OWNER = 'owner-1';
const MOBILE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BACKEND = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CREATED = new Date('2026-10-20T13:00:00.000Z');
const DELETED_AT = new Date('2026-10-22T09:00:00.000Z');

describe('OnTeamDeletedHandler', () => {
  let tasks: InMemoryTaskRepository;
  let handler: OnTeamDeletedHandler;

  const seed = (id: string, teamIds: string[], ownerId = OWNER) => {
    const task = Task.create({
      id,
      ownerId,
      title: TaskTitle.create(`Task ${id}`),
      description: TaskDescription.create(null),
      dueDate: null,
      teamIds: TaskTeamIds.of(teamIds),
      now: CREATED,
    });
    task.pullEvents();
    tasks.seed(task);
  };
  const stored = (id: string) => tasks.all().find((task) => task.id === id);

  beforeEach(() => {
    tasks = new InMemoryTaskRepository();
    handler = new OnTeamDeletedHandler(tasks);
    seed('both', [MOBILE, BACKEND]);
    seed('mobile-only', [MOBILE]);
    seed('backend-only', [BACKEND]);
    seed('theirs', [MOBILE], 'owner-2');
  });

  const deleted = () => new TeamDeleted(MOBILE, OWNER, DELETED_AT);

  it('AC-03.13.1 AC-03.13.2 AC-03.13.4 affected tasks lose only that team, with version + 1 and updated time = the deletion', async () => {
    await handler.handle(deleted());

    expect(stored('both')?.teamIds.values).toEqual([BACKEND]);
    expect(stored('mobile-only')?.teamIds.values).toEqual([]);
    for (const id of ['both', 'mobile-only']) {
      expect(stored(id)?.version).toBe(2);
      expect(stored(id)?.updatedAt).toEqual(DELETED_AT);
    }
  });

  it('unaffected tasks, and other owners’ tasks, are untouched', async () => {
    await handler.handle(deleted());

    expect(stored('backend-only')?.version).toBe(1);
    expect(stored('theirs')?.teamIds.values).toEqual([MOBILE]);
    expect(stored('theirs')?.version).toBe(1);
  });

  it('replaying the event is a no-op', async () => {
    await handler.handle(deleted());
    const update = jest.spyOn(tasks, 'update');

    await handler.handle(deleted());

    expect(update).not.toHaveBeenCalled();
    expect(stored('both')?.version).toBe(2);
  });

  it('takes the team-link lock before reading the tasks', async () => {
    const findByTeam = jest.spyOn(tasks, 'findByTeam');

    await handler.handle(deleted());

    expect(tasks.lockedTeams).toEqual([[MOBILE]]);
    expect(findByTeam).toHaveBeenCalledWith(OWNER, MOBILE);
  });
});
