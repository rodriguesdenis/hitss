import type {
  ListTeamsCriteria,
  TeamReadModel,
  TeamView,
} from '../ports/team.read-model';
import { ListTeamsUseCase } from './list-teams.use-case';

const VIEW: TeamView = {
  id: '7d0c5e2a-3f1b-4c8e-9a6d-2b4f8e1c0a93',
  name: 'Mobile',
  colorHex: '#7C3AED',
  description: null,
  taskCount: 3,
  version: 1,
  createdAt: new Date('2026-10-22T10:00:00.000Z'),
  updatedAt: new Date('2026-10-22T10:00:00.000Z'),
};

const CRITERIA: ListTeamsCriteria = {
  page: { limit: 20, offset: 0 },
  search: 'mob',
  sort: { field: 'createdAt', direction: 'desc' },
};

describe('ListTeamsUseCase', () => {
  it('AC-02.2.1 returns the owner page from the read model, task counts included', async () => {
    const page = jest.fn().mockResolvedValue({ items: [VIEW], total: 1 });
    const useCase = new ListTeamsUseCase({ page } as unknown as TeamReadModel);

    await expect(
      useCase.execute({ ownerId: 'owner-1', ...CRITERIA }),
    ).resolves.toEqual({ items: [VIEW], total: 1 });
    expect(page).toHaveBeenCalledWith('owner-1', CRITERIA);
  });
});
