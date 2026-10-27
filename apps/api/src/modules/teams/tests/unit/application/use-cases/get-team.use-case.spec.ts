import { TeamNotFound } from '../../../../domain/errors/team.errors';
import type {
  TeamReadModel,
  TeamView,
} from '../../../../application/interfaces/team-read-model.interface';
import { GetTeamUseCase } from '../../../../application/use-cases/get-team.use-case';

const VIEW: TeamView = {
  id: '7d0c5e2a-3f1b-4c8e-9a6d-2b4f8e1c0a93',
  name: 'Mobile',
  colorHex: '#7C3AED',
  description: null,
  taskCount: 2,
  version: 1,
  createdAt: new Date('2026-10-22T10:00:00.000Z'),
  updatedAt: new Date('2026-10-22T10:00:00.000Z'),
};

describe('GetTeamUseCase', () => {
  const findById = jest.fn<Promise<TeamView | null>, [string, string]>();
  const useCase = new GetTeamUseCase({
    findById,
  } as unknown as TeamReadModel);

  beforeEach(() => findById.mockReset());

  it('AC-02.8.3 returns the owner-scoped view with its task count', async () => {
    findById.mockResolvedValue(VIEW);

    await expect(
      useCase.execute({ ownerId: 'owner-1', id: VIEW.id }),
    ).resolves.toEqual(VIEW);
    expect(findById).toHaveBeenCalledWith('owner-1', VIEW.id);
  });

  it('an unknown, deleted or foreign team → TeamNotFound', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ ownerId: 'owner-1', id: VIEW.id }),
    ).rejects.toBeInstanceOf(TeamNotFound);
  });
});
