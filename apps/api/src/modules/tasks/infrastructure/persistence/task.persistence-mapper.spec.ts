import { Task } from '../../domain/entities/task.entity';
import { DueDate } from '../../domain/value-objects/due-date.vo';
import { TaskDescription } from '../../domain/value-objects/task-description.vo';
import { TaskStatus } from '../../domain/value-objects/task-status.vo';
import { TaskTeamIds } from '../../domain/value-objects/task-team-ids.vo';
import { TaskTitle } from '../../domain/value-objects/task-title.vo';
import { TaskMapper, TaskRowWithTeams } from './task.persistence-mapper';

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const TEAM_A = '33333333-3333-4333-8333-333333333333';
const TEAM_B = '44444444-4444-4444-8444-444444444444';
const CREATED = new Date('2026-10-21T09:00:00.000Z');
const UPDATED = new Date('2026-10-21T10:00:00.000Z');

const row: TaskRowWithTeams = {
  id: ID,
  ownerId: OWNER,
  title: 'Ship the login screen',
  description: null,
  status: 'DONE',
  dueDate: new Date('2026-10-30T00:00:00.000Z'),
  completedAt: UPDATED,
  version: 4,
  createdAt: CREATED,
  updatedAt: UPDATED,
  deletedAt: null,
  teams: [{ teamId: TEAM_B }, { teamId: TEAM_A }],
};

describe('TaskMapper', () => {
  it('rebuilds the aggregate from a row with its links, raising no events', () => {
    const task = TaskMapper.toDomain(row);

    expect(task.id).toBe(ID);
    expect(task.ownerId).toBe(OWNER);
    expect(task.title.value).toBe('Ship the login screen');
    expect(task.description.value).toBeNull();
    expect(task.status).toBe(TaskStatus.DONE);
    expect(task.dueDate?.value).toBe('2026-10-30');
    expect(task.teamIds.values).toEqual([TEAM_A, TEAM_B]);
    expect(task.completedAt).toEqual(UPDATED);
    expect(task.version).toBe(4);
    expect(task.createdAt).toEqual(CREATED);
    expect(task.updatedAt).toEqual(UPDATED);
    expect(task.deletedAt).toBeNull();
  });

  it('round-trips a row through the aggregate (links aside)', () => {
    const columns: Partial<TaskRowWithTeams> = { ...row };
    delete columns.teams;

    expect({
      ...TaskMapper.toInsert(TaskMapper.toDomain(row)),
      version: 4,
    }).toEqual(columns);
  });

  it('keeps the calendar day of a due date (UTC midnight both ways)', () => {
    const task = TaskMapper.toDomain({
      ...row,
      dueDate: new Date('2026-12-31T00:00:00.000Z'),
    });

    expect(task.dueDate?.value).toBe('2026-12-31');
    expect(TaskMapper.toUpdate(task).dueDate).toEqual(
      new Date('2026-12-31T00:00:00.000Z'),
    );
    expect(TaskMapper.toDomain({ ...row, dueDate: null }).dueDate).toBeNull();
  });

  it('inserts at version 1 and never writes id, owner, version or createdAt on update', () => {
    const task = Task.create({
      ownerId: OWNER,
      title: TaskTitle.create('Plan the sprint'),
      description: TaskDescription.create('Goals'),
      dueDate: DueDate.create('2026-11-02'),
      teamIds: TaskTeamIds.of([]),
      now: CREATED,
    });

    expect(TaskMapper.toInsert(task).version).toBe(1);
    expect(Object.keys(TaskMapper.toUpdate(task)).sort()).toEqual([
      'completedAt',
      'deletedAt',
      'description',
      'dueDate',
      'status',
      'title',
      'updatedAt',
    ]);
  });
});
