import { InMemoryTeamRepository } from '../../../../../../test/support/in-memory-team.repository';
import { Clock } from '../../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../../shared/application/ports/id-generator';
import {
  InvalidColorHex,
  InvalidTeamName,
  TeamNameAlreadyExists,
} from '../../../domain/team.errors';
import { CreateTeamCommand } from './create-team.command';
import { CreateTeamHandler } from './create-team.handler';

const NOW = new Date('2026-10-22T10:00:00.000Z');
const MARINA = 'owner-marina';
const RAFAEL = 'owner-rafael';

class FixedClock extends Clock {
  now(): Date {
    return new Date(NOW);
  }
}

class SequentialIds extends IdGenerator {
  private n = 0;
  next(): string {
    return `00000000-0000-4000-8000-${String(++this.n).padStart(12, '0')}`;
  }
}

describe('CreateTeamHandler', () => {
  let repository: InMemoryTeamRepository;
  let handler: CreateTeamHandler;

  beforeEach(() => {
    repository = new InMemoryTeamRepository();
    handler = new CreateTeamHandler(
      repository,
      new FixedClock(),
      new SequentialIds(),
    );
  });

  const create = (
    ownerId: string,
    name: string,
    colorHex = '#7c3aed',
    description?: string | null,
  ) =>
    handler.execute(
      new CreateTeamCommand(ownerId, name, colorHex, description),
    );

  it('AC-02.1.1 stores a version-1 team with normalized values and returns its new id', async () => {
    const { id } = await create(MARINA, '  Mobile  ', '#7c3aed', '  Apps  ');

    const [team] = repository.all();
    expect(id).toBe('00000000-0000-4000-8000-000000000001');
    expect(team).toMatchObject({ id, ownerId: MARINA, version: 1 });
    expect(team?.name.value).toBe('Mobile');
    expect(team?.color.value).toBe('#7C3AED');
    expect(team?.description.value).toBe('Apps');
    expect(team?.createdAt).toEqual(NOW);
    expect(team?.updatedAt).toEqual(NOW);
  });

  it('AC-02.1.4 a blank description is stored as none', async () => {
    await create(MARINA, 'Mobile', '#7C3AED', '   ');

    expect(repository.all()[0]?.description.value).toBeNull();
  });

  it.each(['mobile', 'MOBILE', ' Mobile '])(
    'AC-02.1.5 %j conflicts with the active "Mobile" of the same owner and creates nothing',
    async (name) => {
      await create(MARINA, 'Mobile');

      await expect(create(MARINA, name)).rejects.toBeInstanceOf(
        TeamNameAlreadyExists,
      );
      expect(repository.all()).toHaveLength(1);
    },
  );

  it('AC-02.1.6 AC-02.11.4 the same name for another owner is created', async () => {
    await create(RAFAEL, 'Mobile');

    await expect(create(MARINA, 'Mobile')).resolves.toEqual({
      id: expect.any(String) as string,
    });
    expect(
      repository
        .all()
        .map((team) => team.ownerId)
        .sort(),
    ).toEqual([MARINA, RAFAEL]);
  });

  it('AC-02.1.7 a deleted team does not reserve its name', async () => {
    const { id } = await create(MARINA, 'Mobile');
    const deleted = await repository.findById(MARINA, id);
    deleted?.delete(NOW);
    await repository.update(deleted!, 1);

    await expect(create(MARINA, 'Mobile')).resolves.toEqual({
      id: expect.any(String) as string,
    });
  });

  it('AC-02.1.9 the unique index decides a race the fast path missed', async () => {
    jest.spyOn(repository, 'existsActiveByName').mockResolvedValue(false);
    await create(MARINA, 'Mobile');

    await expect(create(MARINA, 'mobile')).rejects.toBeInstanceOf(
      TeamNameAlreadyExists,
    );
    expect(repository.all()).toHaveLength(1);
  });

  it('AC-02.1.2 AC-02.1.3 the domain rejects invalid values (defense in depth behind the DTO)', async () => {
    await expect(create(MARINA, 'M')).rejects.toBeInstanceOf(InvalidTeamName);
    await expect(create(MARINA, 'Mobile', 'red')).rejects.toBeInstanceOf(
      InvalidColorHex,
    );
    expect(repository.all()).toHaveLength(0);
  });
});
