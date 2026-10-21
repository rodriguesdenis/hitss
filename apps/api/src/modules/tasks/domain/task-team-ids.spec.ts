import { TooManyTeams } from './errors/too-many-teams.error';
import { TaskTeamIds } from './task-team-ids';

const ids = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `team-${String(i).padStart(2, '0')}`);

describe('TaskTeamIds', () => {
  describe('AC-03.1.6 team count boundaries', () => {
    it.each([0, 1, 10])('accepts %i distinct teams', (count) => {
      expect(TaskTeamIds.of(ids(count)).values).toHaveLength(count);
    });

    it('rejects 11 distinct teams with TooManyTeams { max: 10, received: 11 }', () => {
      let error: unknown;
      try {
        TaskTeamIds.of(ids(11));
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(TooManyTeams);
      expect(error).toMatchObject({
        max: 10,
        received: 11,
        message: 'A task can have at most 10 teams.',
      });
    });
  });

  it('is a set: 11 entries with one repeat are 10 distinct teams (duplicates are a DTO 400 before this)', () => {
    const input = ['team-00', ...ids(10)];
    expect(input).toHaveLength(11);

    expect(TaskTeamIds.of(input).values).toEqual(ids(10));
  });

  it('exposes a copy of the ids', () => {
    const teamIds = TaskTeamIds.of(['a', 'b']);
    teamIds.values.push('c');

    expect(teamIds.values).toEqual(['a', 'b']);
  });

  it('does not keep a reference to the input array', () => {
    const input = ['a', 'b'];
    const teamIds = TaskTeamIds.of(input);
    input.push('c');

    expect(teamIds.values).toEqual(['a', 'b']);
  });

  describe('equals ignores order (AC-03.9.5)', () => {
    it.each([
      [['a', 'b'], ['b', 'a'], true],
      [[], [], true],
      [['a'], ['a', 'b'], false],
      [['a', 'b'], ['a', 'c'], false],
      [['a', 'b'], ['a'], false],
    ])('%j equals %j: %s', (a, b, expected) => {
      expect(TaskTeamIds.of(a).equals(TaskTeamIds.of(b))).toBe(expected);
    });
  });
});
