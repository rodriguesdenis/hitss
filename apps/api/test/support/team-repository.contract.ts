import { randomUUID } from 'node:crypto';
import { Team } from '../../src/modules/teams/domain/entities/team.entity';
import {
  TeamNameAlreadyExists,
  TeamNotFound,
} from '../../src/modules/teams/domain/errors/team.errors';
import { TeamRepository } from '../../src/modules/teams/domain/repositories/team.repository';
import { ColorHex } from '../../src/modules/teams/domain/value-objects/color-hex.vo';
import { TeamName } from '../../src/modules/teams/domain/value-objects/team-name.vo';

export interface TeamRepositoryHarness {
  repository: TeamRepository;
  newOwner(): Promise<string>;
}

const CREATED = new Date('2026-10-20T12:00:00.000Z');
const LATER = new Date('2026-10-20T13:00:00.000Z');

export function aTeam(
  ownerId: string,
  name = 'Mobile',
  extra: { id?: string; color?: string; description?: string | null } = {},
): Team {
  const values = {
    ownerId,
    name: TeamName.create(name),
    color: ColorHex.create(extra.color ?? '#7C3AED'),
    description:
      extra.description === undefined ? 'iOS & Android' : extra.description,
  };
  return extra.id === undefined
    ? Team.create({ ...values, now: CREATED })
    : Team.restore({
        ...values,
        id: extra.id,
        version: 1,
        createdAt: CREATED,
        updatedAt: CREATED,
        deletedAt: null,
      });
}

function rename(team: Team, name: string): Team {
  team.replace({
    name: TeamName.create(name),
    color: team.color,
    description: team.description,
    now: LATER,
  });
  return team;
}

export function describeTeamRepositoryContract(
  harness: () => TeamRepositoryHarness,
): void {
  const repo = () => harness().repository;
  const owner = () => harness().newOwner();

  describe('TeamRepository contract', () => {
    it('stores a new team at version 1 and loads it back', async () => {
      const ownerId = await owner();
      const team = aTeam(ownerId, 'Mobile', { color: '#0EA5E9' });

      await repo().insert(team);
      const loaded = await repo().findById(ownerId, team.id);

      expect(loaded).not.toBeNull();
      expect(loaded).not.toBe(team);
      expect({
        id: loaded!.id,
        ownerId: loaded!.ownerId,
        name: loaded!.name.value,
        color: loaded!.color.value,
        description: loaded!.description,
        version: loaded!.version,
        createdAt: loaded!.createdAt,
        updatedAt: loaded!.updatedAt,
        deletedAt: loaded!.deletedAt,
      }).toEqual({
        id: team.id,
        ownerId,
        name: 'Mobile',
        color: '#0EA5E9',
        description: 'iOS & Android',
        version: 1,
        createdAt: CREATED,
        updatedAt: CREATED,
        deletedAt: null,
      });
    });

    it('keeps a null description', async () => {
      const ownerId = await owner();
      const team = aTeam(ownerId, 'Plain', { description: null });

      await repo().insert(team);

      expect((await repo().findById(ownerId, team.id))!.description).toBeNull();
    });

    it('AC-02.5.2 AC-02.5.3 AC-02.5.4 returns null for a foreign, unknown, malformed or deleted id', async () => {
      const [ownerId, stranger] = [await owner(), await owner()];
      const team = aTeam(ownerId);
      await repo().insert(team);
      const gone = aTeam(ownerId, 'Gone');
      await repo().insert(gone);
      gone.delete(LATER);
      await repo().update(gone);

      await expect(repo().findById(stranger, team.id)).resolves.toBeNull();
      await expect(repo().findById(ownerId, randomUUID())).resolves.toBeNull();
      await expect(repo().findById(ownerId, 'not-a-uuid')).resolves.toBeNull();
      await expect(repo().findById(ownerId, gone.id)).resolves.toBeNull();
    });

    it('returns a fresh copy: changing it without update leaves the store as it was', async () => {
      const ownerId = await owner();
      const team = aTeam(ownerId);
      await repo().insert(team);

      rename((await repo().findById(ownerId, team.id))!, 'Changed');

      const again = await repo().findById(ownerId, team.id);
      expect(again!.name.value).toBe('Mobile');
      expect(again!.updatedAt).toEqual(CREATED);
    });

    describe('existsActiveByName', () => {
      it('matches the owner’s active teams case-insensitively', async () => {
        const ownerId = await owner();
        await repo().insert(aTeam(ownerId, 'Mobile'));

        await expect(
          repo().existsActiveByName(ownerId, TeamName.create('MOBILE')),
        ).resolves.toBe(true);
        await expect(
          repo().existsActiveByName(ownerId, TeamName.create('Backend')),
        ).resolves.toBe(false);
      });

      it('ignores other owners, deleted teams and the excluded id', async () => {
        const [ownerId, stranger] = [await owner(), await owner()];
        const team = aTeam(ownerId, 'Mobile');
        await repo().insert(team);
        const gone = aTeam(ownerId, 'Archive');
        await repo().insert(gone);
        gone.delete(LATER);
        await repo().update(gone);

        await expect(
          repo().existsActiveByName(stranger, TeamName.create('Mobile')),
        ).resolves.toBe(false);
        await expect(
          repo().existsActiveByName(ownerId, TeamName.create('archive')),
        ).resolves.toBe(false);
        await expect(
          repo().existsActiveByName(
            ownerId,
            TeamName.create('mobile'),
            team.id,
          ),
        ).resolves.toBe(false);
      });

      it.each([
        ['ΟΔΟΣ', 'οδοσ', true],
        ['ΟΔΟΣ', 'οδος', false],
        ['İstanbul', 'istanbul', true],
        ['Équipe', 'équipe', true],
        ['Équipe', 'Equipe', false],
      ])('%s vs %s → collides: %s', async (stored, probe, collides) => {
        const ownerId = await owner();
        await repo().insert(aTeam(ownerId, stored));

        await expect(
          repo().existsActiveByName(ownerId, TeamName.create(probe)),
        ).resolves.toBe(collides);
        const insert = repo().insert(aTeam(ownerId, probe));
        if (collides) {
          await expect(insert).rejects.toBeInstanceOf(TeamNameAlreadyExists);
        } else {
          await expect(insert).resolves.toBeUndefined();
        }
      });
    });

    describe('insert', () => {
      it('AC-02.1.9 rejects a second active team with the same name (any case)', async () => {
        const ownerId = await owner();
        await repo().insert(aTeam(ownerId, 'Mobile'));

        await expect(
          repo().insert(aTeam(ownerId, 'mobile')),
        ).rejects.toBeInstanceOf(TeamNameAlreadyExists);
      });

      it('allows the name of a deleted team and the same name for another owner', async () => {
        const [ownerId, stranger] = [await owner(), await owner()];
        const gone = aTeam(ownerId, 'Mobile');
        await repo().insert(gone);
        gone.delete(LATER);
        await repo().update(gone);

        await expect(
          repo().insert(aTeam(ownerId, 'Mobile')),
        ).resolves.toBeUndefined();
        await expect(
          repo().insert(aTeam(stranger, 'Mobile')),
        ).resolves.toBeUndefined();
      });
    });

    describe('update', () => {
      it('writes the new state and returns the incremented version', async () => {
        const ownerId = await owner();
        const team = aTeam(ownerId, 'Mobile');
        await repo().insert(team);

        const loaded = (await repo().findById(ownerId, team.id))!;
        loaded.replace({
          name: TeamName.create('Mobile Squad'),
          color: ColorHex.create('#F59E0B'),
          description: null,
          now: LATER,
        });

        await expect(repo().update(loaded)).resolves.toBeUndefined();
        const stored = (await repo().findById(ownerId, team.id))!;
        expect(stored.name.value).toBe('Mobile Squad');
        expect(stored.color.value).toBe('#F59E0B');
        expect(stored.description).toBeNull();
        expect(stored.version).toBe(2);
        expect(stored.createdAt).toEqual(CREATED);
        expect(stored.updatedAt).toEqual(LATER);
      });

      it('AC-08.3 last write wins: an update from an older load still applies and bumps the version', async () => {
        const ownerId = await owner();
        const team = aTeam(ownerId);
        await repo().insert(team);
        await repo().update(rename(team, 'First'));

        await repo().update(rename(team, 'Second'));

        const stored = (await repo().findById(ownerId, team.id))!;
        expect(stored.name.value).toBe('Second');
        expect(stored.version).toBe(3);
      });

      it('AC-02.6.6 reports a foreign or unknown team as not found', async () => {
        const [ownerId, stranger] = [await owner(), await owner()];
        const team = aTeam(ownerId);
        await repo().insert(team);
        const impostor = Team.restore({
          id: team.id,
          ownerId: stranger,
          name: TeamName.create('Hijack'),
          color: team.color,
          description: team.description,
          version: 1,
          createdAt: CREATED,
          updatedAt: LATER,
          deletedAt: null,
        });

        await expect(repo().update(impostor)).rejects.toBeInstanceOf(
          TeamNotFound,
        );
        await expect(
          repo().update(aTeam(ownerId, 'Never stored')),
        ).rejects.toBeInstanceOf(TeamNotFound);
        expect((await repo().findById(ownerId, team.id))!.name.value).toBe(
          'Mobile',
        );
      });

      it('soft-deletes through update; a second delete is not found', async () => {
        const ownerId = await owner();
        const team = aTeam(ownerId);
        await repo().insert(team);

        team.delete(LATER);
        await expect(repo().update(team)).resolves.toBeUndefined();
        await expect(repo().findById(ownerId, team.id)).resolves.toBeNull();
        await expect(repo().update(team)).rejects.toBeInstanceOf(TeamNotFound);
      });

      it('rejects a rename onto another active team’s name', async () => {
        const ownerId = await owner();
        await repo().insert(aTeam(ownerId, 'Backend'));
        const team = aTeam(ownerId, 'Mobile');
        await repo().insert(team);

        await expect(
          repo().update(rename(team, 'BACKEND')),
        ).rejects.toBeInstanceOf(TeamNameAlreadyExists);
        expect((await repo().findById(ownerId, team.id))!.version).toBe(1);
      });

      it('allows a letter-case-only rename of the team itself', async () => {
        const ownerId = await owner();
        const team = aTeam(ownerId, 'mobile');
        await repo().insert(team);

        await expect(
          repo().update(rename(team, 'Mobile')),
        ).resolves.toBeUndefined();
      });
    });
  });
}
