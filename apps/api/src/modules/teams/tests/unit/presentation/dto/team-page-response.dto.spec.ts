import type { TeamView } from '../../../../application/interfaces/team-read-model.interface';
import { TeamPageResponseDto } from '../../../../presentation/dto/team-page-response.dto';
import { TeamResponseDto } from '../../../../presentation/dto/team-response.dto';

const view = (id: string): TeamView => ({
  id,
  name: `Team ${id}`,
  colorHex: '#7C3AED',
  description: null,
  taskCount: 2,
  version: 1,
  createdAt: new Date('2026-10-20T13:00:00.000Z'),
  updatedAt: new Date('2026-10-20T13:00:00.000Z'),
});

describe('TeamPageResponseDto.from', () => {
  it('AC-10.8 maps each view and builds the page meta', () => {
    const found = { items: [view('a')], total: 3 };

    expect(TeamPageResponseDto.from(found, { limit: 1, offset: 2 })).toEqual({
      data: [TeamResponseDto.from(view('a'))],
      meta: { total: 3, limit: 1, offset: 2, hasNextPage: false },
    });
  });
});
