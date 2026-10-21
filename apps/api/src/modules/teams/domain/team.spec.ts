import { ConcurrencyConflict } from '../../../shared/domain/domain-error';
import { ExpectedVersion } from '../../../shared/domain/expected-version';
import { ColorHex } from './color-hex';
import { TeamDeleted } from './events/team-deleted.event';
import { Team } from './team';
import { TeamDescription } from './team-description';
import { TeamName } from './team-name';

const CREATED_ISO = '2026-10-20T10:00:00.000Z';
const LATER_ISO = '2026-10-20T11:00:00.000Z';
const CREATED_AT = new Date(CREATED_ISO);
const LATER = new Date(LATER_ISO);
const TEAM_ID = '7d0c5e2a-3f1b-4c8e-9a6d-2b4f8e1c0a93';
const OWNER_ID = 'owner-1';

function backend(): Team {
  return Team.create({
    id: TEAM_ID,
    ownerId: OWNER_ID,
    name: TeamName.create('Backend'),
    color: ColorHex.create('#2563EB'),
    description: TeamDescription.create('APIs'),
    now: CREATED_AT,
  });
}

function replacement(
  name: string,
  color: string,
  description?: string | null,
): Parameters<Team['replace']>[0] {
  return {
    name: TeamName.create(name),
    color: ColorHex.create(color),
    description: TeamDescription.create(description),
    now: LATER,
  };
}

describe('Team', () => {
  describe('create', () => {
    it('AC-02.1.1 starts at version 1 with equal creation and update times', () => {
      const team = backend();

      expect(team.id).toBe(TEAM_ID);
      expect(team.ownerId).toBe(OWNER_ID);
      expect(team.name.value).toBe('Backend');
      expect(team.color.value).toBe('#2563EB');
      expect(team.description.value).toBe('APIs');
      expect(team.version).toBe(1);
      expect(team.createdAt).toEqual(CREATED_AT);
      expect(team.updatedAt).toEqual(CREATED_AT);
      expect(team.deletedAt).toBeNull();
    });

    it('raises no event', () => {
      expect(backend().pullEvents()).toEqual([]);
    });
  });

  describe('reconstitute', () => {
    it('restores a persisted team as is, without events', () => {
      const deletedAt = new Date('2026-10-21T08:00:00.000Z');
      const team = Team.reconstitute({
        id: TEAM_ID,
        ownerId: OWNER_ID,
        name: TeamName.create('Mobile'),
        color: ColorHex.create('#7C3AED'),
        description: TeamDescription.create(null),
        version: 4,
        createdAt: CREATED_AT,
        updatedAt: LATER,
        deletedAt,
      });

      expect(team.name.value).toBe('Mobile');
      expect(team.color.value).toBe('#7C3AED');
      expect(team.description.value).toBeNull();
      expect(team.version).toBe(4);
      expect(team.createdAt).toEqual(CREATED_AT);
      expect(team.updatedAt).toEqual(LATER);
      expect(team.deletedAt).toEqual(deletedAt);
      expect(team.pullEvents()).toEqual([]);
    });
  });

  describe('replace', () => {
    it('AC-02.6.7 returns false and changes nothing when the normalized values are equal', () => {
      const team = backend();

      const changed = team.replace(replacement(' Backend ', '#2563eb', 'APIs'));

      expect(changed).toBe(false);
      expect(team.version).toBe(1);
      expect(team.updatedAt).toEqual(CREATED_AT);
      expect(team.pullEvents()).toEqual([]);
    });

    it.each([
      ['the name', replacement('Platform', '#2563EB', 'APIs')],
      ['the color', replacement('Backend', '#7C3AED', 'APIs')],
      ['the description', replacement('Backend', '#2563EB', 'Services')],
    ])(
      'AC-02.6.1 returns true and touches updatedAt when %s changes',
      (_label, next) => {
        const team = backend();

        expect(team.replace(next)).toBe(true);
        expect(team.name.value).toBe(next.name.value);
        expect(team.color.value).toBe(next.color.value);
        expect(team.description.value).toBe(next.description.value);
        expect(team.updatedAt).toEqual(LATER);
        expect(team.createdAt).toEqual(CREATED_AT);
        expect(team.version).toBe(1); // persistence bumps the version
      },
    );

    it('AC-02.6.1 replaces every field at once', () => {
      const team = backend();

      expect(team.replace(replacement('Platform', '#7c3aed', 'Infra'))).toBe(
        true,
      );
      expect(team.name.value).toBe('Platform');
      expect(team.color.value).toBe('#7C3AED');
      expect(team.description.value).toBe('Infra');
    });

    it('AC-02.6.5 a letter-case-only rename is a change', () => {
      const team = backend();

      expect(team.replace(replacement('BACKEND', '#2563EB', 'APIs'))).toBe(
        true,
      );
      expect(team.name.value).toBe('BACKEND');
    });

    it('AC-02.6.3 omitting the description clears it', () => {
      const team = backend();

      expect(team.replace(replacement('Backend', '#2563EB'))).toBe(true);
      expect(team.description.value).toBeNull();
    });
  });

  describe('delete', () => {
    it('AC-02.7.1 sets deletedAt and raises exactly one TeamDeleted', () => {
      const team = backend();

      team.delete(LATER);

      expect(team.deletedAt).toEqual(LATER);
      const events = team.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TeamDeleted);
      expect(events[0]).toEqual(new TeamDeleted(TEAM_ID, OWNER_ID, LATER));
    });

    it('deleting twice is a no-op: no second event, first deletion time kept', () => {
      const team = backend();
      team.delete(LATER);
      team.pullEvents();

      team.delete(new Date('2026-10-22T00:00:00.000Z'));

      expect(team.deletedAt).toEqual(LATER);
      expect(team.pullEvents()).toEqual([]);
    });
  });

  describe('timestamps are not shared with callers', () => {
    it('getters return copies: mutating them does not change the team', () => {
      const team = Team.create({
        id: TEAM_ID,
        ownerId: OWNER_ID,
        name: TeamName.create('Backend'),
        color: ColorHex.create('#2563EB'),
        description: TeamDescription.create(null),
        now: new Date(CREATED_ISO),
      });
      team.delete(new Date(LATER_ISO));

      team.createdAt.setFullYear(2000);
      team.updatedAt.setFullYear(2000);
      team.deletedAt?.setFullYear(2000);

      expect(team.createdAt.toISOString()).toBe(CREATED_ISO);
      expect(team.updatedAt.toISOString()).toBe(CREATED_ISO);
      expect(team.deletedAt?.toISOString()).toBe(LATER_ISO);
    });

    it('inputs are copied: mutating the Date passed in does not change the team', () => {
      const created = new Date(CREATED_ISO);
      const replaced = new Date(LATER_ISO);
      const deleted = new Date(LATER_ISO);
      const team = Team.create({
        id: TEAM_ID,
        ownerId: OWNER_ID,
        name: TeamName.create('Backend'),
        color: ColorHex.create('#2563EB'),
        description: TeamDescription.create(null),
        now: created,
      });
      team.replace({ ...replacement('Platform', '#2563EB'), now: replaced });
      team.delete(deleted);

      created.setFullYear(2000);
      replaced.setFullYear(2000);
      deleted.setFullYear(2000);

      expect(team.createdAt.toISOString()).toBe(CREATED_ISO);
      expect(team.updatedAt.toISOString()).toBe(LATER_ISO);
      expect(team.deletedAt?.toISOString()).toBe(LATER_ISO);
    });

    it('reconstituted dates are copied too', () => {
      const props = {
        id: TEAM_ID,
        ownerId: OWNER_ID,
        name: TeamName.create('Backend'),
        color: ColorHex.create('#2563EB'),
        description: TeamDescription.create(null),
        version: 3,
        createdAt: new Date(CREATED_ISO),
        updatedAt: new Date(LATER_ISO),
        deletedAt: new Date(LATER_ISO),
      };
      const team = Team.reconstitute(props);

      props.createdAt.setFullYear(2000);
      props.updatedAt.setFullYear(2000);
      props.deletedAt.setFullYear(2000);

      expect(team.createdAt.toISOString()).toBe(CREATED_ISO);
      expect(team.updatedAt.toISOString()).toBe(LATER_ISO);
      expect(team.deletedAt?.toISOString()).toBe(LATER_ISO);
    });

    it('the TeamDeleted event does not share the deletion Date', () => {
      const team = Team.create({
        id: TEAM_ID,
        ownerId: OWNER_ID,
        name: TeamName.create('Backend'),
        color: ColorHex.create('#2563EB'),
        description: TeamDescription.create(null),
        now: new Date(CREATED_ISO),
      });
      const deleted = new Date(LATER_ISO);
      team.delete(deleted);
      deleted.setFullYear(2000);

      expect(team.pullEvents()[0]?.occurredAt.toISOString()).toBe(LATER_ISO);
    });
  });

  describe('assertVersion', () => {
    it('AC-02.9.4 accepts any version when there is no precondition', () => {
      expect(() =>
        backend().assertVersion(ExpectedVersion.any()),
      ).not.toThrow();
    });

    it('AC-02.9.1 accepts the current version', () => {
      expect(() =>
        backend().assertVersion(ExpectedVersion.exact(1)),
      ).not.toThrow();
    });

    it('AC-02.9.2 rejects a stale version with the current version', () => {
      const team = Team.reconstitute({
        id: TEAM_ID,
        ownerId: OWNER_ID,
        name: TeamName.create('Backend'),
        color: ColorHex.create('#2563EB'),
        description: TeamDescription.create('APIs'),
        version: 2,
        createdAt: CREATED_AT,
        updatedAt: LATER,
        deletedAt: null,
      });

      let error: unknown;
      try {
        team.assertVersion(ExpectedVersion.exact(1));
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(ConcurrencyConflict);
      expect(error).toMatchObject({ currentVersion: 2 });
    });

    it('AC-02.9.6 rejects an unmatchable precondition', () => {
      expect(() =>
        backend().assertVersion(ExpectedVersion.unmatchable()),
      ).toThrow(ConcurrencyConflict);
    });
  });
});
