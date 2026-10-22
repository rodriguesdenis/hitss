import { toTeamResponse } from '../../../../../presentation/http/presenters/team.presenter';

describe('toTeamResponse', () => {
  it('AC-02.1.1 serializes a team with ISO timestamps and only the documented fields', () => {
    const response = toTeamResponse({
      id: 'team-1',
      name: 'Mobile',
      colorHex: '#7C3AED',
      description: null,
      version: 1,
      createdAt: new Date('2026-10-22T10:00:00.000Z'),
      updatedAt: new Date('2026-10-22T10:00:01.000Z'),
      taskCount: 0,
      ...({ ownerId: 'never-sent' } as object),
    });

    expect(response).toStrictEqual({
      id: 'team-1',
      name: 'Mobile',
      colorHex: '#7C3AED',
      description: null,
      taskCount: 0,
      version: 1,
      createdAt: '2026-10-22T10:00:00.000Z',
      updatedAt: '2026-10-22T10:00:01.000Z',
    });
  });
});
