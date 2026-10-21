import { randomUUID } from 'node:crypto';
import { InMemoryTeamRepository } from './in-memory-team.repository';
import { describeTeamRepositoryContract } from './team-repository.contract';

describe('InMemoryTeamRepository', () => {
  let repository: InMemoryTeamRepository;

  beforeEach(() => {
    repository = new InMemoryTeamRepository();
  });

  describeTeamRepositoryContract(() => ({
    repository,
    newOwner: () => Promise.resolve(randomUUID()),
  }));
});
