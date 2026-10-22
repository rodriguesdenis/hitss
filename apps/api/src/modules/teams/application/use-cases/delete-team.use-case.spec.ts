import { InMemoryTeamRepository } from '../../../../../test/support/in-memory-team.repository';
import { Clock } from '../../../../shared/domain/clock';
import { Team } from '../../domain/entities/team.entity';
import { TeamNotFound } from '../../domain/errors/team.errors';
import { ColorHex } from '../../domain/value-objects/color-hex.vo';
import { TeamName } from '../../domain/value-objects/team-name.vo';
import { DeleteTeamUseCase } from './delete-team.use-case';

const CREATED = new Date('2026-10-22T10:00:00.000Z');
const LATER = new Date('2026-10-22T11:00:00.000Z');
const MARINA = 'owner-marina';
const ID = '00000000-0000-4000-8000-000000000001';

class FixedClock extends Clock {
  now(): Date {
    return new Date(LATER);
  }
}

describe('DeleteTeamUseCase', () => {
  let repository: InMemoryTeamRepository;
  let useCase: DeleteTeamUseCase;

  beforeEach(() => {
    repository = new InMemoryTeamRepository();
    repository.seed(
      Team.restore({
        id: ID,
        ownerId: MARINA,
        name: TeamName.create('Mobile'),
        color: ColorHex.create('#7C3AED'),
        description: null,
        version: 1,
        createdAt: CREATED,
        updatedAt: CREATED,
        deletedAt: null,
      }),
    );
    useCase = new DeleteTeamUseCase(repository, new FixedClock());
  });

  const remove = (ownerId = MARINA, id = ID) =>
    useCase.execute({ ownerId, id });

  it('AC-02.7.1 soft-deletes the team at the clock time through the repository delete (one transaction there)', async () => {
    const remove$ = jest.spyOn(repository, 'delete');

    await remove();

    expect(remove$).toHaveBeenCalledTimes(1);
    expect(remove$.mock.calls[0]?.[0].deletedAt).toEqual(LATER);
    expect(await repository.findById(MARINA, ID)).toBeNull();
    expect(repository.all()[0]?.deletedAt).toEqual(LATER);
  });

  it.each([
    ['unknown', MARINA, '00000000-0000-4000-8000-000000000099'],
    ['foreign', 'owner-rafael', ID],
  ])(
    'AC-02.7.3 a %s team → 404, nothing deleted',
    async (_label, ownerId, id) => {
      const remove$ = jest.spyOn(repository, 'delete');

      await expect(remove(ownerId, id)).rejects.toBeInstanceOf(TeamNotFound);
      expect(remove$).not.toHaveBeenCalled();
      expect(repository.all()[0]?.deletedAt).toBeNull();
    },
  );

  it('AC-02.7.3 deleting twice → 404 the second time', async () => {
    await remove();

    await expect(remove()).rejects.toBeInstanceOf(TeamNotFound);
  });
});
