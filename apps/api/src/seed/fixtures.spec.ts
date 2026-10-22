import { ColorHex } from '../modules/teams/domain/value-objects/color-hex';
import { TeamName } from '../modules/teams/domain/value-objects/team-name';
import { TaskTitle } from '../modules/tasks/domain/value-objects/task-title';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_TASK_IDS,
  DEMO_TEAM_IDS,
  DEMO_USER_ID,
  demoTaskFixtures,
  demoTeamFixtures,
} from './fixtures';

const SEED_DAY = new Date('2026-10-22T15:30:00.000Z');
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('demo seed fixtures', () => {
  const teams = demoTeamFixtures();
  const tasks = demoTaskFixtures(SEED_DAY);

  it('AC-01.8.1 the demo account is demo@teams-tasks.dev with the documented password and a fixed id', () => {
    expect(DEMO_EMAIL).toBe('demo@teams-tasks.dev');
    expect(DEMO_PASSWORD).toBe('Demo@1234');
    expect(DEMO_USER_ID).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('AC-07.2.2 seeds exactly 3 teams: Mobile, Backend and Design with their colors', () => {
    expect(teams.map((t) => [t.name, t.colorHex])).toEqual([
      ['Mobile', '#7C3AED'],
      ['Backend', '#0EA5E9'],
      ['Design', '#F59E0B'],
    ]);
  });

  it('AC-07.2.3 every id is a fixed, distinct UUID', () => {
    const ids = [...teams.map((t) => t.id), ...tasks.map((t) => t.id)];
    expect(new Set(ids).size).toBe(13);
    for (const id of ids) expect(id).toMatch(UUID);
    expect(DEMO_TEAM_IDS).toEqual(teams.map((t) => t.id));
    expect(DEMO_TASK_IDS).toEqual(tasks.map((t) => t.id));
  });

  it('AC-07.2.2 seeds exactly 10 tasks covering all three statuses (4 pending, 3 in progress, 3 done)', () => {
    expect(tasks).toHaveLength(10);
    const count = (status: string) =>
      tasks.filter((t) => t.status === status).length;
    expect([count('PENDING'), count('IN_PROGRESS'), count('DONE')]).toEqual([
      4, 3, 3,
    ]);
  });

  it('AC-07.2.2 has a task in two or more teams, one in three, and one without a team', () => {
    const sizes = tasks.map((t) => t.teamIds.length);
    expect(sizes.filter((n) => n >= 2).length).toBeGreaterThanOrEqual(1);
    expect(sizes).toContain(3);
    expect(sizes).toContain(0);
    for (const task of tasks) {
      for (const teamId of task.teamIds)
        expect(DEMO_TEAM_IDS).toContain(teamId);
    }
  });

  it('AC-07.2.2 has an overdue task and a task due in the future, relative to the seed day', () => {
    const today = SEED_DAY.toISOString().slice(0, 10);
    const open = tasks.filter((t) => t.status !== 'DONE' && t.dueDate);
    expect(open.some((t) => (t.dueDate as string) < today)).toBe(true);
    expect(open.some((t) => (t.dueDate as string) > today)).toBe(true);
  });

  it('AC-07.2.3 the fixtures are deterministic: the same seed day gives identical data, another day shifts only due dates', () => {
    expect(demoTaskFixtures(SEED_DAY)).toEqual(tasks);
    const later = demoTaskFixtures(new Date('2026-11-05T01:00:00.000Z'));
    const withoutDue = (list: typeof tasks) =>
      list.map((t) => ({ ...t, dueDate: undefined }));
    expect(withoutDue(later)).toEqual(withoutDue(tasks));
    expect(later.map((t) => t.dueDate)).not.toEqual(
      tasks.map((t) => t.dueDate),
    );
  });

  it('AC-07.2.2 done tasks have a completion time, the others have none', () => {
    for (const task of tasks) {
      expect(task.completedAt === null).toBe(task.status !== 'DONE');
    }
  });

  it('AC-07.2.2 every title, name and color is valid for the domain', () => {
    for (const team of teams) {
      expect(() => TeamName.create(team.name)).not.toThrow();
      expect(() => ColorHex.create(team.colorHex)).not.toThrow();
    }
    for (const task of tasks)
      expect(() => TaskTitle.create(task.title)).not.toThrow();
  });

  it('AC-07.2.3 timestamps are fixed literals, never the current time', () => {
    for (const row of [...teams, ...tasks]) {
      expect(row.createdAt.getTime()).toBeLessThan(
        new Date('2026-06-01').getTime(),
      );
      expect(row.updatedAt.getTime()).toBeGreaterThanOrEqual(
        row.createdAt.getTime(),
      );
    }
  });
});
