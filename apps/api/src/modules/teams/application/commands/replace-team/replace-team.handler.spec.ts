import { InMemoryTeamRepository } from '../../../../../../test/support/in-memory-team.repository';
import { Clock } from '../../../../../shared/application/ports/clock';
import { ConcurrencyConflict } from '../../../../../shared/domain/domain-error';
import { ExpectedVersion } from '../../../../../shared/domain/expected-version';
import { Team } from '../../../domain/team';
import {
  TeamNameAlreadyExists,
  TeamNotFound,
} from '../../../domain/team.errors';
import { ColorHex } from '../../../domain/value-objects/color-hex';
import { TeamDescription } from '../../../domain/value-objects/team-description';
import { TeamName } from '../../../domain/value-objects/team-name';
import { ReplaceTeamCommand } from './replace-team.command';
import { ReplaceTeamHandler } from './replace-team.handler';

const CREATED = new Date('2026-10-22T10:00:00.000Z');
const LATER = new Date('2026-10-22T11:00:00.000Z');
const MARINA = 'owner-marina';
const MOBILE_ID = '00000000-0000-4000-8000-000000000001';
const BACKEND_ID = '00000000-0000-4000-8000-000000000002';

class FixedClock extends Clock {
  now(): Date {
    return new Date(LATER);
  }
}

const team = (id: string, name: string, description: string | null = 'Apps') =>
  Team.create({
    id,
    ownerId: MARINA,
    name: TeamName.create(name),
    color: ColorHex.create('#7C3AED'),
    description: TeamDescription.create(description),
    now: CREATED,
  });

describe('ReplaceTeamHandler', () => {
  let repository: InMemoryTeamRepository;
  let handler: ReplaceTeamHandler;

  beforeEach(() => {
    repository = new InMemoryTeamRepository();
    repository.seed(team(MOBILE_ID, 'Mobile'));
    repository.seed(team(BACKEND_ID, 'Backend'));
    handler = new ReplaceTeamHandler(repository, new FixedClock());
  });

  const replace = (
    id: string,
    values: { name: string; colorHex?: string; description?: string | null },
    expected = ExpectedVersion.any(),
    ownerId = MARINA,
  ) =>
    handler.execute(
      new ReplaceTeamCommand(
        ownerId,
        id,
        values.name,
        values.colorHex ?? '#7C3AED',
        values.description,
        expected,
      ),
    );

  const stored = async (id: string) => repository.findById(MARINA, id);

  it('AC-02.6.1 AC-02.9.1 replaces every field, bumps the version and advances updatedAt', async () => {
    await expect(
      replace(
        MOBILE_ID,
        { name: ' Platform ', colorHex: '#0ea5e9', description: 'Infra' },
        ExpectedVersion.exact(1),
      ),
    ).resolves.toEqual({ id: MOBILE_ID });

    const after = await stored(MOBILE_ID);
    expect(after?.name.value).toBe('Platform');
    expect(after?.color.value).toBe('#0EA5E9');
    expect(after?.description.value).toBe('Infra');
    expect(after?.version).toBe(2);
    expect(after?.updatedAt).toEqual(LATER);
    expect(after?.createdAt).toEqual(CREATED);
  });

  it('AC-02.6.3 omitting the description clears it', async () => {
    await replace(MOBILE_ID, { name: 'Mobile' });

    expect((await stored(MOBILE_ID))?.description.value).toBeNull();
  });

  it('AC-02.6.7 the same values after normalization are a no-op: version and updatedAt kept', async () => {
    const update = jest.spyOn(repository, 'update');

    await replace(MOBILE_ID, {
      name: ' Mobile ',
      colorHex: '#7c3aed',
      description: 'Apps',
    });

    expect(update).not.toHaveBeenCalled();
    expect((await stored(MOBILE_ID))?.version).toBe(1);
    expect((await stored(MOBILE_ID))?.updatedAt).toEqual(CREATED);
  });

  it('AC-02.6.5 a letter-case-only rename of itself is allowed', async () => {
    await replace(MOBILE_ID, { name: 'MOBILE', description: 'Apps' });

    expect((await stored(MOBILE_ID))?.name.value).toBe('MOBILE');
  });

  it('AC-02.6.4 renaming to another active team name → 409 and nothing changes', async () => {
    await expect(
      replace(BACKEND_ID, { name: 'mobile' }),
    ).rejects.toBeInstanceOf(TeamNameAlreadyExists);
    expect((await stored(BACKEND_ID))?.name.value).toBe('Backend');
    expect((await stored(BACKEND_ID))?.version).toBe(1);
  });

  it.each([
    ['unknown', '00000000-0000-4000-8000-000000000099', MARINA],
    ['foreign', MOBILE_ID, 'owner-rafael'],
  ])(
    'AC-02.6.6 AC-02.9.7 a %s team → 404, even with a stale If-Match (404 wins over 412)',
    async (_label, id, ownerId) => {
      await expect(
        replace(id, { name: 'Platform' }, ExpectedVersion.exact(9), ownerId),
      ).rejects.toBeInstanceOf(TeamNotFound);
    },
  );

  it('AC-02.6.6 a deleted team → 404', async () => {
    const mobile = await stored(MOBILE_ID);
    mobile?.delete(LATER);
    await repository.update(mobile!, 1);

    await expect(
      replace(MOBILE_ID, { name: 'Platform' }),
    ).rejects.toBeInstanceOf(TeamNotFound);
  });

  it('AC-02.9.2 a stale If-Match → ConcurrencyConflict with the current version, team unchanged', async () => {
    await replace(MOBILE_ID, { name: 'Mobile v2' });

    await expect(
      replace(MOBILE_ID, { name: 'Platform' }, ExpectedVersion.exact(1)),
    ).rejects.toEqual(new ConcurrencyConflict(2));
    expect((await stored(MOBILE_ID))?.name.value).toBe('Mobile v2');
  });

  it('AC-02.9.6 an unmatchable If-Match → ConcurrencyConflict, before the no-op check', async () => {
    await expect(
      replace(
        MOBILE_ID,
        { name: 'Mobile', description: 'Apps' },
        ExpectedVersion.unmatchable(),
      ),
    ).rejects.toBeInstanceOf(ConcurrencyConflict);
  });

  it('AC-02.9.4 without If-Match, a concurrent write between load and save is retried once', async () => {
    const update = jest.spyOn(repository, 'update');
    update.mockRejectedValueOnce(new ConcurrencyConflict(2));

    await expect(replace(MOBILE_ID, { name: 'Platform' })).resolves.toEqual({
      id: MOBILE_ID,
    });
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('AC-02.9.4 the retry happens at most once', async () => {
    jest
      .spyOn(repository, 'update')
      .mockRejectedValue(new ConcurrencyConflict(3));

    await expect(
      replace(MOBILE_ID, { name: 'Platform' }),
    ).rejects.toBeInstanceOf(ConcurrencyConflict);
  });

  it('AC-02.9.5 with If-Match a lost race is a 412, never retried', async () => {
    const update = jest.spyOn(repository, 'update');
    update.mockRejectedValueOnce(new ConcurrencyConflict(2));

    await expect(
      replace(MOBILE_ID, { name: 'Platform' }, ExpectedVersion.exact(1)),
    ).rejects.toBeInstanceOf(ConcurrencyConflict);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
